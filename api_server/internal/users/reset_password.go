package users

type ErrPasswordResetIssue struct {
	Password string `json:"password,omitempty"`
}

func (e *ErrPasswordResetIssue) Error() string {
	return "password reset issue"
}
