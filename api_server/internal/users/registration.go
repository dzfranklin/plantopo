package users

type RegisterRequest struct {
	Email    string `json:"email"`
	FullName string `json:"fullName"`
	Password string `json:"password"`
}

type ErrRegistrationIssue struct {
	Email    string `json:"email,omitempty"`
	FullName string `json:"fullName,omitempty"`
	Password string `json:"password,omitempty"`
}

func (e ErrRegistrationIssue) Error() string {
	return "registration issue"
}

func (r *RegisterRequest) Validate() *ErrRegistrationIssue {
	err := ErrRegistrationIssue{
		Email:    validateEmail(r.Email),
		FullName: validateFullName(r.FullName),
		Password: validatePassword(r.Password),
	}

	if err.Email == "" && err.FullName == "" && err.Password == "" {
		return nil
	} else {
		return &err
	}
}
