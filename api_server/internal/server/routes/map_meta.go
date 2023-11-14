package routes

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/danielzfranklin/plantopo/api_server/internal/loggers"
	"github.com/danielzfranklin/plantopo/api_server/internal/mapsync"
	"github.com/danielzfranklin/plantopo/api_server/internal/types"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"io"
	"net/http"
	"time"

	"github.com/danielzfranklin/plantopo/api_server/internal/maps"
	"github.com/gorilla/mux"
)

func (s *Services) mapsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "POST":
		s.postMapsHandler(w, r)
	case "DELETE":
		s.deleteMapsHandler(w, r)
	default:
		writeMethodNotAllowed(r, w)
	}
}

type createMapRequest struct {
	CopyFrom string `json:"copyFrom"`
}

func (s *Services) postMapsHandler(w http.ResponseWriter, r *http.Request) {
	l := loggers.FromCtx(r.Context()).Sugar()
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeError(r, w, err)
		return
	} else if sess == nil {
		writeUnauthorized(r, w)
		return
	}

	var req createMapRequest
	if err = json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(r, w)
		return
	}

	if req.CopyFrom != "" {
		newMap, err := s.Maps.CreateCopy(r.Context(), req.CopyFrom)
		if errors.Is(err, maps.ErrMapNotFound) {
			writeNotFound(r, w)
			return
		}
		if err != nil {
			writeError(r, w, err)
			return
		}

		go s.copyMapInto(l, req.CopyFrom, newMap)

		writeData(r, w, newMap)
	} else {
		meta, err := s.Maps.Create(r.Context(), sess.UserId)
		if err != nil {
			writeError(r, w, err)
			return
		}
		writeData(r, w, meta)
	}
}

func (s *Services) copyMapInto(l *zap.SugaredLogger, copyFrom string, newMap types.MapMeta) {
	ctx := context.Background()
	l = l.With("copyFrom", copyFrom, "newMapId", newMap.Id)
	l.Info("copying map")

	var err error
	defer func() {
		if err != nil {
			l.Errorw("error copying map", zap.Error(err))
		}
	}()

	var exportURL string
	exportURL, err = s.MapExporter.Export(ctx, copyFrom, mapsync.ExportInfo{
		Name:     newMap.Name,
		Filename: "copy.json",
		Format:   "ptinternal",
	})
	if err != nil {
		return
	}
	l.Info("exported map to copy from")

	var exportResp *http.Response
	if exportResp, err = http.Get(exportURL); err != nil {
		return
	}
	defer exportResp.Body.Close()

	var export []byte
	if export, err = io.ReadAll(exportResp.Body); err != nil {
		return
	}
	l.Info("downloaded export")
	exportMD5 := md5.Sum(export)
	encodedExportMD5 := base64.StdEncoding.EncodeToString(exportMD5[:])

	var imp *mapsync.Import
	imp, err = s.MapImporter.CreateImport(ctx, &mapsync.CreateImportRequest{
		MapId:      newMap.Id,
		Filename:   "copy.json",
		Format:     "ptinternal",
		ContentMD5: encodedExportMD5,
	})
	if err != nil {
		return
	}
	l.Info("created import")

	var uploadReq *http.Request
	if uploadReq, err = http.NewRequest("PUT", imp.UploadURL, bytes.NewReader(export)); err != nil {
		return
	}
	uploadReq.Header.Set("Content-MD5", encodedExportMD5)

	var upload *http.Response
	upload, err = http.DefaultClient.Do(uploadReq)
	if err != nil {
		return
	}
	defer upload.Body.Close()
	if upload.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(upload.Body)
		err = fmt.Errorf("upload failed: %s: %s", upload.Status, body)
		return
	}
	l.Info("uploaded import")

	var status *mapsync.Import

	status, err = s.MapImporter.StartImport(imp.Id)
	if err != nil {
		return
	}
	l.Info("started import")

	for status.Status != "complete" && status.Status != "failed" {
		time.Sleep(1 * time.Second)
		status, err = s.MapImporter.CheckImport(ctx, status.MapId)
		l.Infof("waiting for import: %s", status.Status)
		if err != nil {
			return
		}
	}
	if status.Status == "failed" {
		err = fmt.Errorf("import failed: %s", status.StatusMessage)
		return
	}
	l.Info("copied map")
}

type deleteRequest struct {
	List []string `json:"list"`
}

func (s *Services) deleteMapsHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeError(r, w, err)
		return
	} else if sess == nil {
		writeBadRequest(r, w)
		return
	}

	var req deleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(r, w)
		return
	}

	for _, id := range req.List {
		if !s.Maps.IsAuthorized(r.Context(),
			maps.AuthzRequest{UserId: sess.UserId, MapId: id},
			maps.ActionDelete,
		) {
			writeForbidden(r, w)
			return
		}
	}

	if err := s.Maps.Delete(r.Context(), req.List); err != nil {
		writeInternalError(r, w, err)
		return
	}

	writeData(r, w, nil)
}

func (s *Services) mapHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		s.getMapHandler(w, r)
	case "PUT":
		s.putMapHandler(w, r)
	default:
		writeMethodNotAllowed(r, w)
	}
}

type mapMetaDto struct {
	Id                    string    `json:"id"`
	Name                  string    `json:"name"`
	CreatedAt             time.Time `json:"createdAt"`
	CurrentSessionMayEdit bool      `json:"currentSessionMayEdit"`
}

func (s *Services) getMapHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(r, w, err)
		return
	}

	mapId := mux.Vars(r)["id"]

	// Fetch before authorizing so we can return a 404 if the map doesn't exist.
	data, err := s.Maps.Get(r.Context(), mapId)
	if errors.Is(err, maps.ErrMapNotFound) {
		writeNotFound(r, w)
		return
	} else if err != nil {
		writeInternalError(r, w, err)
		return
	}

	authzReq := maps.AuthzRequest{MapId: mapId}
	if sess != nil {
		authzReq.UserId = sess.UserId
	}
	if !s.Maps.IsAuthorized(r.Context(), authzReq, maps.ActionView) {
		if sess == nil {
			writeUnauthorized(r, w)
			return
		} else {
			writeForbidden(r, w)
			return
		}
	}

	sessionMayEdit := s.Maps.IsAuthorized(r.Context(), authzReq, maps.ActionEdit)

	writeData(r, w, mapMetaDto{
		Id:                    data.Id,
		Name:                  data.Name,
		CreatedAt:             data.CreatedAt,
		CurrentSessionMayEdit: sessionMayEdit,
	})
}

func (s *Services) putMapHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(r, w, err)
		return
	} else if sess == nil {
		writeBadRequest(r, w)
		return
	}

	mapId := mux.Vars(r)["id"]

	var req maps.MetaUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(r, w)
		return
	}
	req.Id = mapId

	if !s.Maps.IsAuthorized(r.Context(),
		maps.AuthzRequest{UserId: sess.UserId, MapId: mapId},
		maps.ActionEdit,
	) {
		writeForbidden(r, w)
		return
	}

	data, err := s.Maps.Put(r.Context(), req)
	if errors.Is(err, maps.ErrMapNotFound) {
		writeNotFound(r, w)
		return
	} else if err != nil {
		writeInternalError(r, w, err)
		return
	}

	writeData(r, w, mapMetaDto{
		Id:                    data.Id,
		Name:                  data.Name,
		CreatedAt:             data.CreatedAt,
		CurrentSessionMayEdit: true, // checked above
	})
}

func (s *Services) mapAccessHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		s.getMapAccessHandler(w, r)
	case "PUT":
		s.putMapAccessHandler(w, r)
	default:
		writeMethodNotAllowed(r, w)
	}
}

func (s *Services) getMapAccessHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(r, w, err)
		return
	} else if sess == nil {
		writeBadRequest(r, w)
		return
	}

	mapId := mux.Vars(r)["id"]

	if !s.Maps.IsAuthorized(r.Context(),
		maps.AuthzRequest{UserId: sess.UserId, MapId: mapId},
		maps.ActionViewAccess,
	) {
		writeForbidden(r, w)
		return
	}

	value, err := s.Maps.Access(r.Context(), mapId)
	if errors.Is(err, maps.ErrMapNotFound) {
		writeNotFound(r, w)
		return
	}

	writeData(r, w, value)
}

func (s *Services) putMapAccessHandler(w http.ResponseWriter, r *http.Request) {
	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeInternalError(r, w, err)
		return
	} else if sess == nil {
		writeBadRequest(r, w)
		return
	}

	user, err := sess.GetUser()
	if err != nil {
		writeInternalError(r, w, err)
		return
	}

	mapId := mux.Vars(r)["id"]

	var req maps.PutAccessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(r, w)
		return
	}
	req.MapId = mapId

	if !s.Maps.IsAuthorized(r.Context(),
		maps.AuthzRequest{UserId: sess.UserId, MapId: mapId},
		maps.ActionShare,
	) {
		writeForbidden(r, w)
		return
	}

	if err := s.Maps.PutAccess(r.Context(), user, req); err != nil {
		if errors.Is(err, maps.ErrMapNotFound) {
			writeError(r, w, &ErrorReply{
				Code:    http.StatusNotFound,
				Message: "map not found",
			})
			return
		} else {
			writeInternalError(r, w, err)
			return
		}
	}

	fmt.Println("calling access")
	updatedValue, err := s.Maps.Access(r.Context(), mapId)
	fmt.Println("called access")
	if errors.Is(err, maps.ErrMapNotFound) {
		writeNotFound(r, w)
		return
	} else if err != nil {
		writeInternalError(r, w, err)
		return
	}

	writeData(r, w, updatedValue)
}

type requestMapAccessRequest struct {
	RequestedRole maps.Role `json:"requestedRole"`
	Message       string    `json:"message"`
}

func (s *Services) requestMapAccessHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(r, w)
		return
	}

	sess, err := s.SessionManager.GetUserId(r)
	if err != nil {
		writeError(r, w, err)
		return
	}
	if sess == uuid.Nil {
		writeUnauthorized(r, w)
		return
	}

	mapId := mux.Vars(r)["id"]

	var req requestMapAccessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeBadRequest(r, w)
		return
	}

	err = s.Maps.RequestAccess(r.Context(), maps.RequestAccessRequest{
		MapId:          mapId,
		RequestedRole:  req.RequestedRole,
		RequestingUser: sess,
		Message:        req.Message,
	})
	if errors.Is(err, maps.ErrMapNotFound) {
		writeNotFound(r, w)
		return
	}
	if err != nil {
		writeError(r, w, err)
		return
	}

	writeData(r, w, nil)
}

func (s *Services) pendingAccessRequestsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeMethodNotAllowed(r, w)
		return
	}

	sess, err := s.SessionManager.GetUserId(r)
	if err != nil {
		return
	}
	if sess == uuid.Nil {
		writeUnauthorized(r, w)
		return
	}

	list, err := s.Maps.ListPendingAccessRequestsToRecipient(r.Context(), sess)
	if err != nil {
		writeError(r, w, err)
		return
	}

	writeData(r, w, list)
}

func (s *Services) approveAccessRequestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(r, w)
		return
	}

	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeError(r, w, err)
		return
	}
	user, err := sess.GetUser()
	if err != nil {
		writeError(r, w, err)
		return
	}

	requestId := mux.Vars(r)["id"]

	err = s.Maps.ApproveAccessRequestIfAuthorized(r.Context(), user, requestId)
	if err != nil {
		writeError(r, w, err)
		return
	}

	writeData(r, w, nil)
}

func (s *Services) rejectAccessRequestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeMethodNotAllowed(r, w)
		return
	}

	sess, err := s.SessionManager.Get(r)
	if err != nil {
		writeError(r, w, err)
		return
	}
	user, err := sess.GetUser()
	if err != nil {
		writeError(r, w, err)
		return
	}

	requestId := mux.Vars(r)["id"]

	err = s.Maps.RejectAccessRequestIfAuthorized(r.Context(), user, requestId)
	if err != nil {
		writeError(r, w, err)
		return
	}

	writeData(r, w, nil)
}
