package pgeograph

import (
	"compress/gzip"
	_ "embed"
	"errors"
	"fmt"
	"github.com/pingcap/tidb/pkg/parser"
	"github.com/pingcap/tidb/pkg/parser/ast"
	"github.com/pingcap/tidb/pkg/parser/test_driver"
	"golang.org/x/text/encoding/charmap"
	"io"
	"log/slog"
	"math"
	"strconv"
	"strings"
	"time"
)

type gridimage struct {
	// gridimage_base

	GridimageID int
	UserID      int
	Realname    string
	Title       string
	ImageTaken  time.Time
	WGS84Lat    float64
	WGS84Long   float64

	// gridimage_size

	Width          int
	Height         int
	OriginalWidth  int
	OriginalHeight int
}

/*
CREATE TABLE `gridimage_base` (
0:  `gridimage_id` int(11) NOT NULL DEFAULT 0,
1:  `user_id` int(11) NOT NULL DEFAULT 0,
2:  `realname` varchar(128) NOT NULL DEFAULT '',
3:  `title` varchar(128) NOT NULL,
4:  `moderation_status` enum('rejected','pending','accepted','geograph') NOT NULL DEFAULT 'pending',
5:  `imagetaken` date NOT NULL DEFAULT '0000-00-00',
6:  `grid_reference` varchar(6) NOT NULL DEFAULT '',
7:  `x` smallint(3) NOT NULL DEFAULT 0,
8:  `y` smallint(4) NOT NULL DEFAULT 0,
9:  `wgs84_lat` decimal(10,6) NOT NULL DEFAULT 0.000000,
10:  `wgs84_long` decimal(10,6) NOT NULL DEFAULT 0.000000,
11:  `reference_index` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`gridimage_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
*/

const (
	baseIndexGridimageID = 0
	baseIndexUserID      = 1
	baseIndexRealname    = 2
	baseIndexTitle       = 3
	baseIndexImageTaken  = 5
	baseIndexWGS84Lat    = 9
	baseIndexWGS84Long   = 10
)

/*
DROP TABLE IF EXISTS `gridimage_size`;
CREATE TABLE `gridimage_size` (
  0: `gridimage_id` int(10) unsigned NOT NULL,
  1: `width` smallint(5) unsigned NOT NULL,
  2: `height` smallint(5) unsigned NOT NULL,
  3: `original_width` mediumint(8) unsigned NOT NULL DEFAULT 0,
  4: `original_height` mediumint(8) unsigned NOT NULL DEFAULT 0,
  5: `original_diff` enum('unknown','no','yes') DEFAULT 'unknown',
  PRIMARY KEY (`gridimage_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
*/

const (
	sizeIndexGridimageID    = 0
	sizeIndexWidth          = 1
	sizeIndexHeight         = 2
	sizeIndexOriginalWidth  = 3
	sizeIndexOriginalHeight = 4
)

func parseDump(
	l *slog.Logger,
	cutoff int,
	baseFile, sizeFile io.Reader,
) (nextCutoff int, gridimages map[int]*gridimage, err error) {
	defer func() {
		if excp := recover(); excp != nil {
			switch v := excp.(type) {
			case string:
				err = errors.New(v)
			case error:
				err = v
			default:
				err = errors.New(fmt.Sprint(v))
			}
		}
	}()

	p := parser.New()

	baseNodes := parseDumpFile(l, p, baseFile)
	gridimages = parseBaseDump(cutoff, baseNodes)

	sizeNodes := parseDumpFile(l, p, sizeFile)
	parseSizeDump(cutoff, sizeNodes, gridimages)

	nextCutoff = cutoff
	for id := range gridimages {
		nextCutoff = max(nextCutoff, id)
	}

	return
}

func parseBaseDump(cutoff int, nodes []ast.StmtNode) map[int]*gridimage {
	out := make(map[int]*gridimage)
	for _, node := range nodes {
		if stmt, ok := node.(*ast.InsertStmt); ok {
			for _, list := range stmt.Lists {
				gridimageID := intNodeValue(list[baseIndexGridimageID])
				if gridimageID <= cutoff {
					continue
				}
				entry := &gridimage{
					GridimageID: gridimageID,
					UserID:      intNodeValue(list[baseIndexUserID]),
					Realname:    stringNodeValue(list[baseIndexRealname]),
					Title:       stringNodeValue(list[baseIndexTitle]),
					ImageTaken:  dateNodeValue(list[baseIndexImageTaken]),
					WGS84Lat:    floatNodeValue(list[baseIndexWGS84Lat]),
					WGS84Long:   floatNodeValue(list[baseIndexWGS84Long]),
				}
				out[entry.GridimageID] = entry
			}
		}
	}
	return out
}

func parseSizeDump(cutoff int, nodes []ast.StmtNode, gridimages map[int]*gridimage) {
	for _, node := range nodes {
		if stmt, ok := node.(*ast.InsertStmt); ok {
			for _, list := range stmt.Lists {
				gridimageID := intNodeValue(list[sizeIndexGridimageID])

				if gridimageID <= cutoff {
					continue
				}

				entry, gridimageOk := gridimages[gridimageID]
				if !gridimageOk {
					continue
				}

				entry.Width = intNodeValue(list[sizeIndexWidth])
				entry.Height = intNodeValue(list[sizeIndexHeight])
				entry.OriginalWidth = intNodeValue(list[sizeIndexOriginalWidth])
				entry.OriginalHeight = intNodeValue(list[sizeIndexOriginalHeight])
			}
		}
	}
}

func parseDumpFile(l *slog.Logger, p *parser.Parser, r io.Reader) []ast.StmtNode {
	unzippedR, unzipErr := gzip.NewReader(r)
	if unzipErr != nil {
		panic(unzipErr)
	}

	decodedR := charmap.ISO8859_1.NewDecoder().Reader(unzippedR)
	decodedBytes, decodeErr := io.ReadAll(decodedR)
	if decodeErr != nil {
		panic(decodeErr)
	}

	nodes, warns, parseErr := p.Parse(string(decodedBytes), "latin1", "latin1_swedish_ci")
	if parseErr != nil {
		panic(parseErr)
	}
	for _, warn := range warns {
		l.Warn("parse dump file warning", "warning", warn)
	}

	return nodes
}

func intNodeValue(node ast.ExprNode) int {
	stmt := node.(*test_driver.ValueExpr)
	if stmt.Kind() != test_driver.KindInt64 {
		panic("wrong kind")
	}
	v := stmt.GetInt64()
	if v > math.MaxInt {
		panic("int too big")
	}
	return int(v)
}

func stringNodeValue(node ast.ExprNode) string {
	stmt := node.(*test_driver.ValueExpr)
	if stmt.Kind() != test_driver.KindString {
		panic("wrong kind")
	}
	return stmt.GetString()
}

func floatNodeValue(node ast.ExprNode) float64 {
	v := stringNodeValue(node)
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		panic(err)
	}
	return f
}

func dateNodeValue(node ast.ExprNode) time.Time {
	v := stringNodeValue(node)

	if v == "0000-00-00" {
		return time.Time{}
	} else if strings.HasSuffix(v, "-00-00") {
		v = strings.TrimSuffix(v, "-00-00") + "-01-01"
	} else if strings.HasSuffix(v, "-00") {
		v = strings.TrimSuffix(v, "-00") + "-01"
	}

	t, err := time.Parse("2006-01-02", v)

	if err != nil {
		panic(err)
	}
	return t
}
