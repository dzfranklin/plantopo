package main

import (
	"compress/gzip"
	"encoding/json"
	"github.com/dzfranklin/plantopo/backend/internal/pmunroaccess"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

var munroMu sync.Mutex
var munroWorker *pmunroaccess.GederWorker
var otpParallelism = 6

func main() {
	addr := "0.0.0.0:2001"

	otpHost := os.Getenv("OTP_HOST")
	if otpHost == "" {
		panic("Missing OTP_HOST")
	}
	otpGTFSEndpoint := "http://" + otpHost + "/otp/gtfs/v1"

	otpParallelismVar := os.Getenv("OTP_PARALLELISM")
	if otpParallelismVar != "" {
		v, err := strconv.ParseInt(otpParallelismVar, 10, 32)
		if err != nil {
			panic("Invalid OTP_PARALLELISM")
		}
		otpParallelism = int(v)
	}
	log.Println("Using otpParallelism", otpParallelism)

	munroWorker = pmunroaccess.NewGederWorker(otpGTFSEndpoint)

	http.HandleFunc("POST /v1/submit-munro-access-job", postSubmitMunroAccessJob)

	log.Println("Listening on", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}

func postSubmitMunroAccessJob(w http.ResponseWriter, r *http.Request) {
	if !munroMu.TryLock() {
		log.Println("refusing munro job: busy")
		http.Error(w, "Too Fast", http.StatusTooManyRequests)
		return
	}
	defer munroMu.Unlock()

	var req struct {
		From [2]float64 `json:"from"`
		Date time.Time  `json:"date"`
	}
	reqBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Bad Request: read boy", http.StatusBadRequest)
		return
	}
	if err := json.Unmarshal(reqBody, &req); err != nil {
		http.Error(w, "Bad Request: unmarshal body", http.StatusBadRequest)
		return
	}
	if (req.From[0] == 0 && req.From[1] == 0) || req.Date.IsZero() {
		http.Error(w, "Bad Request: missing required", http.StatusBadRequest)
		return
	}

	log.Println("generating munro access report")
	report, err := munroWorker.Generate(r.Context(), req.From, req.Date, otpParallelism)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	log.Println("generated munro access report")

	w.Header().Set("Content-Type", "encoding/json")
	w.Header().Set("Content-Encoding", "gzip")

	gw, err := gzip.NewWriterLevel(w, gzip.BestCompression)
	if err != nil {
		panic(err)
	}
	defer func() { _ = gw.Close() }()

	_ = json.NewEncoder(gw).Encode(report)
}
