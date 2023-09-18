package users

type RequestPasswordResetRequest struct {
	Email string `json:"email"`
}

type CheckPasswordResetRequest struct {
	Token string `json:"token"`
}

type CompletePasswordResetRequest struct {
	Token                string `json:"token"`
	Password             string `json:"password"`
	PasswordConfirmation string `json:"passwordConfirmation"`
}
