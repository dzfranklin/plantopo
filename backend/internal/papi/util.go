package papi

func omitEmptyString(v string) OptString {
	if v == "" {
		return OptString{}
	} else {
		return OptString{Value: v, Set: true}
	}
}
