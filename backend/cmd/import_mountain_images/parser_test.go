package main

import (
	_ "embed"
	"github.com/stretchr/testify/assert"
	"testing"
)

//go:embed test_samples/export.xml
var sampleExport []byte

func TestParseExport(t *testing.T) {
	got := parseExport(sampleExport)
	expected := map[int64]mountainPhoto{
		7968774:  {Name: "A' Chralaig", File: "View towards A' Chralaig from An Cnapach - geograph.org.uk - 1005411.jpg", Caption: "A' Chralaig from the northwest"},
		18090542: {Name: "A' Bhuidheanach Bheag", File: "A_Bhuidheanach_Beag_from_Sow.jpg", Caption: "A' Bhuidheanach Bheag seen across the Pass of Drumochter from The Sow of Atholl."},
		60923268: {Name: "A' Chailleach", File: "Loch Toll an Lochain - geograph.org.uk - 904948.jpg", Caption: "A' Chailleach"},
		69911013: {Name: "A' Chailleach", File: "Meall_a'_Bhothain_-_geograph.org.uk_-_105615.jpg", Caption: "View of A' Chailleach from Meall a' Bhothain"},
		60723330: {Name: "A' Ghlas-bhienn", File: "The summit of A' Ghlas-bheinn - geograph.org.uk - 519738.jpg", Caption: "The summit of A' Ghlas-bhienn"},
		20327910: {Name: "A' Mhaighdean", File: "A-Mhaighdean-from-Slioch.jpg", Caption: "View of A' Mhaighdean from Slioch"},
		17951169: {Name: "A' Mharconaich", File: "A_Mharconaich_from_the_south.jpg", Caption: "A' Mharconaich from the south, the track up Coire Dhomhain is clearly in view."},
	}

	assert.Equal(t, expected, got)
}

//go:embed test_samples/munro_page.txt
var sampleMunroPage []byte

//go:embed test_samples/page_without_infobox.txt
var samplePageWithoutInfobox []byte

func TestParseMunroPage(t *testing.T) {
	t.Run("munro page", func(t *testing.T) {
		got := parsePage(sampleMunroPage)
		expected := &mountainPhoto{
			Name:    "A' Mhaighdean",
			File:    "A-Mhaighdean-from-Slioch.jpg",
			Caption: "View of A' Mhaighdean from Slioch",
		}
		assert.Equal(t, expected, got)
	})

	t.Run("page without infobox", func(t *testing.T) {
		got := parsePage(samplePageWithoutInfobox)
		assert.Nil(t, got)
	})
}
