package users

type ErrNotFound struct{}

func (e ErrNotFound) Error() string {
	return "not found"
}

type ErrTokenExpired struct{}

func (e ErrTokenExpired) Error() string {
	return "token expired"
}
