package perrors

import "errors"

func Into[T error](err error) (val T, ok bool) {
	ok = errors.As(err, &val)
	return val, ok
}
