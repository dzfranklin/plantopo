package admin

import (
	"github.com/dzfranklin/plantopo/backend/internal/pimg"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"net/http"
)

func (app *adminApp) reviewBritishAndIrishHillPhotos(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var form struct {
			ID      string `form:"ID,required"`
			Approve bool
		}
		if err := app.decodePostForm(r, &form); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		if form.Approve {
			app.Logger.Info("approving", "id", form.ID)
			if err := app.BritishAndIrishHills.ApproveHillPhoto(form.ID); err != nil {
				panic(err)
			}
		}
	}

	p, err := app.BritishAndIrishHills.GetUnreviewedPhoto()
	if err != nil {
		panic(err)
	}
	if p == nil {
		app.render(w, r, "review_british_and_irish_hill_photo.tmpl", M{"Done": true})
		return
	}

	hill, err := app.BritishAndIrishHills.Get(p.HillID)
	if err != nil {
		panic(err)
	}

	type photo struct {
		Src           string
		Width, Height int
	}

	small := photo{Width: 333, Height: 250}
	small.Src = app.Img.Source(p.Source).
		Width(small.Width).Height(small.Height).ResizingType(pimg.ResizeFill).Dpr(2).Build("jpg")

	original := photo{
		Width:  p.Width,
		Height: p.Height,
		Src:    p.Source,
	}

	decodedID, err := prepo.IDToInt("bihp", p.ID)
	if err != nil {
		panic(err)
	}

	app.render(w, r, "review_british_and_irish_hill_photo.tmpl", M{
		"Meta":      p,
		"Hill":      hill,
		"DecodedID": decodedID,
		"Small":     small,
		"Original":  original,
	})
}
