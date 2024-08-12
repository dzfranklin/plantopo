package ordnancesurvey

import "github.com/twpayne/go-proj/v10"

func newFromBNG() *proj.PJ {
	pj, err := proj.NewCRSToCRS("EPSG:27700", "EPSG:4326", nil)
	if err != nil {
		panic(err)
	}
	return pj
}
