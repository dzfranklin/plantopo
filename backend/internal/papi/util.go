package papi

func omitEmptyString(v string) OptString {
	if v == "" {
		return OptString{}
	} else {
		return OptString{Value: v, Set: true}
	}
}

func NewPoint(v [2]float64) Point {
	return Point{v[0], v[1]}
}
