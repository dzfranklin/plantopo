package prepo

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tidwall/geojson/geometry"
	"regexp"
	"strings"
)

type GBPostcode struct {
	db *pgxpool.Pool
}

func NewGBPostcode(env *pconfig.Env) *GBPostcode {
	return &GBPostcode{db: env.DB}
}

type GBPostcodePoint struct {
	Code  string
	Point geometry.Point
}

func (r *GBPostcode) Get(ctx context.Context, code string) (GBPostcodePoint, error) {
	row, err := q.SelectGBPostcodePoint(ctx, r.db, code)
	if err != nil {
		return GBPostcodePoint{}, err
	}
	return mapGBPostcodePoint(row), nil
}

var normalizedGBPostcodePrefixRe = regexp.MustCompile(`^[A-Z0-9]+$`)

func NormalizePostcode(code string) string {
	return strings.ToUpper(strings.ReplaceAll(code, " ", ""))
}

func (r *GBPostcode) Search(ctx context.Context, prefix string, bias *geometry.Point) ([]GBPostcodePoint, error) {
	normalizedPrefix := NormalizePostcode(prefix)
	if !normalizedGBPostcodePrefixRe.MatchString(normalizedPrefix) || len(normalizedPrefix) < 3 {
		return nil, nil
	}

	if bias == nil {
		rows, err := q.SearchGBPostcode(ctx, r.db, pgText(normalizedPrefix))
		if err != nil {
			return nil, err
		}
		return pslices.Map(rows, func(row psqlc.SearchGBPostcodeRow) GBPostcodePoint {
			return mapGBPostcodePoint(psqlc.SelectGBPostcodePointRow(row))
		}), nil
	} else {
		rows, err := q.SearchGBPostcodeBiased(ctx, r.db, psqlc.SearchGBPostcodeBiasedParams{
			NormalizedPrefix: pgText(normalizedPrefix),
			BiasLng:          bias.X,
			BiasLat:          bias.Y,
		})
		if err != nil {
			return nil, err
		}
		return pslices.Map(rows, func(row psqlc.SearchGBPostcodeBiasedRow) GBPostcodePoint {
			return mapGBPostcodePoint(psqlc.SelectGBPostcodePointRow(row))
		}), nil
	}
}

func (r *GBPostcode) Set(ctx context.Context, postcodes []GBPostcodePoint) error {
	var input []psqlc.BulkInsertGBPostcodePointsParams
	for _, entry := range postcodes {
		input = append(input, psqlc.BulkInsertGBPostcodePointsParams{
			Code:  entry.Code,
			Point: psqlc.Point(entry.Point),
		})
	}

	tx, txErr := r.db.Begin(ctx)
	if txErr != nil {
		return txErr
	}
	defer tx.Rollback(ctx)

	if err := q.DeleteAllDBPostcodePoints(ctx, tx); err != nil {
		return err
	}
	if _, err := q.BulkInsertGBPostcodePoints(ctx, tx, input); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func mapGBPostcodePoint(row psqlc.SelectGBPostcodePointRow) GBPostcodePoint {
	return GBPostcodePoint{
		Code:  row.Code,
		Point: geometry.Point(row.Point),
	}
}
