package admin

import "net/http"

func (app *adminApp) geophotosFlickrRegionsGet(w http.ResponseWriter, r *http.Request) {
	list, err := app.Geophotos.FlickrIndexRegions()
	if err != nil {
		panic(err)
	}

	app.render(w, r, "geophotos_flickr_regions.tmpl", M{
		"List": list,
	})
}
