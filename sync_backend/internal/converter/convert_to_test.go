package converter

import (
	"embed"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"
	"strings"
	"testing"
)

//go:embed testdata/*
var testdata embed.FS

func TestConvertSample(t *testing.T) {
	l := zaptest.NewLogger(t).Sugar()

	input, err := testdata.Open("testdata/fife_coastal_path.gpx")
	require.NoError(t, err)

	got, err := convertGpxToChangeset(l, "testid", "fife_coastal_path.gpx", input)
	require.NoError(t, err)

	require.Equal(t, 1, len(got.FAdd))
	require.Equal(t, 1, len(got.FSet))
	gotF := got.FSet[got.FAdd[0]]
	require.Equal(t, "testid", gotF.ImportedFromFile)
	require.Equal(t, "Fife Coastal Path", gotF.Name)
	gotGeom := gotF.Geometry.LineString
	require.NotNil(t, gotGeom)
	require.Equal(t, 1526, len(gotGeom.Coordinates))
}

func TestConvertGpxBasic(t *testing.T) {
	l := zaptest.NewLogger(t).Sugar()
	input := strings.NewReader(`
<?xml version="1.0" encoding="ISO-8859-1"?>
<gpx version="1.1" 
creator="Memory-Map 5.4.2.1089 http://www.memory-map.com"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 xmlns="http://www.topografix.com/GPX/1/1"
 xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
<trk>
	<name>Fife Coastal Path</name>
	<type>Track</type>
	<trkseg>
		<trkpt lat="56.0668773730" lon="-3.7222567180"></trkpt>
		<trkpt lat="56.0667683870" lon="-3.7225059720"></trkpt>
		<trkpt lat="56.0666656740" lon="-3.7225763040"></trkpt>
	</trkseg>
	<trkseg>
		<trkpt lat="56.0668773730" lon="-3.7222567180"></trkpt>
		<trkpt lat="56.0667683870" lon="-3.7225059720"></trkpt>
	</trkseg>
</trk>
<wpt lat="35.878170" lon="-121.385980">
	<ele>688.5</ele>
	<name>AlderCreekCamp</name>
	<desc>Perennial stream {GPS=j.glendening}</desc>
	<sym>Navaid, Green</sym>
</wpt>
<rte>
	<rtept lat="13.09993" lon="77.58959">
		<name>Start</name>
		<cmt>Start of route</cmt>
	</rtept>
	<rtept lat="13.10052" lon="77.58847">
		<name>Left</name>
		<cmt>Turn left onto SH 9</cmt>
	</rtept>
</rte>
</gpx>
	`)
	cset, err := convertGpxToChangeset(l, "testid", "test-basic.gpx", input)
	require.NoError(t, err)
	require.NoError(t, err)
	require.Equal(t, 6, len(cset.FAdd))
}

func TestSingleSegmentTrackIsFlattened(t *testing.T) {
	l := zaptest.NewLogger(t).Sugar()
	input := strings.NewReader(`
<?xml version="1.0" encoding="ISO-8859-1"?>
<gpx version="1.1" 
 creator="Memory-Map 5.4.2.1089 http://www.memory-map.com"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 xmlns="http://www.topografix.com/GPX/1/1"
 xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
<trk>
	<name>Fife Coastal Path</name>
	<type>Track</type>
	<trkseg>
		<trkpt lat="56.0668773730" lon="-3.7222567180"></trkpt>
		<trkpt lat="56.0667683870" lon="-3.7225059720"></trkpt>
		<trkpt lat="56.0666656740" lon="-3.7225763040"></trkpt>
	</trkseg>
</trk>
</gpx>`)
	cset, err := convertGpxToChangeset(l, "testid", "test-single-segment-track.gpx", input)
	require.NoError(t, err)
	require.Equal(t, 1, len(cset.FAdd))
	feat := cset.FSet[cset.FAdd[0]]
	require.Equal(t, "", feat.Parent)
}
