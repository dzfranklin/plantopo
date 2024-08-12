package prepo

import (
	"encoding/json"
	"fmt"
	"github.com/trustelem/zxcvbn"
	"regexp"
	"unicode/utf8"
)

type Validator struct {
	GeneralErrors []string          `json:"general,omitempty"`
	FieldErrors   map[string]string `json:"field,omitempty"`
}

type ErrValidation struct {
	*Validator
}

func (v *Validator) ToError() error {
	if v.IsInvalid() {
		return &ErrValidation{v}
	} else {
		return nil
	}
}
func (v *ErrValidation) Error() string {
	value, err := json.Marshal(v)
	if err != nil {
		return "<failed to serialize ErrValidation>"
	}
	return fmt.Sprintf("validation error: %s", value)
}

func (v ErrValidation) MarshalJSON() ([]byte, error) {
	return json.Marshal(v.Validator)
}

func (v *Validator) IsValid() bool {
	return len(v.GeneralErrors) == 0 && len(v.FieldErrors) == 0
}

func (v *Validator) IsInvalid() bool {
	return !v.IsValid()
}

func (v *Validator) GeneralCheck(ok bool, message string) {
	if !ok {
		v.AddGeneralError(message)
	}
}

func (v *Validator) Check(ok bool, field string, message string) {
	if !ok {
		v.AddError(field, message)
	}
}

func (v *Validator) AddGeneralError(message string) {
	v.GeneralErrors = append(v.GeneralErrors, message)
}

func (v *Validator) AddError(field, message string) {
	if v.FieldErrors == nil {
		v.FieldErrors = make(map[string]string)
	}
	if _, exists := v.FieldErrors[field]; !exists {
		v.FieldErrors[field] = message
	}
}

func (v *Validator) WithError(field, message string) *Validator {
	v.AddError(field, message)
	return v
}

var (
	// EmailRX is from <https://html.spec.whatwg.org/#valid-e-mail-address>
	EmailRX = regexp.MustCompile("^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$")
)

func (v *Validator) CheckNotEmpty(value, field string) {
	v.Check(value != "", field, "is required")
}

func (v *Validator) CheckLength(value string, field string, minLen, maxLen int) {
	if len(value) < minLen {
		if len(value) == 0 {
			v.AddError(field, "is required")
		} else {
			v.AddError(field, fmt.Sprintf("must be at least %d characters", minLen))
		}
	}
	v.Check(len(value) <= maxLen, field, fmt.Sprintf("must not be more than %d characters", maxLen))
}

func (v *Validator) CheckEmail(value string, field string) {
	v.Check(EmailRX.MatchString(value), field, "is invalid")
}

func (v *Validator) CheckPassword(value string, field string, minStrength int, userInputs []string) {
	v.CheckLength(value, field, 8, 100)

	if !utf8.Valid([]byte(value)) {
		// This shouldn't happen but check just in case because zxcvbn fails open if not
		panic("non-utf8 password")
	}
	passwordStrength := zxcvbn.PasswordStrength(value, userInputs)
	if passwordStrength.Score < minStrength {
		v.AddError(field, "is too weak")
	}
}
