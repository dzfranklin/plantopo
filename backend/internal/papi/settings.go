package papi

import (
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
)

func (h *phandler) SettingsGet(ctx context.Context) (*SettingsGetOK, error) {
	user, hasUser := getAuthenticatedUser(ctx)
	if !hasUser {
		return nil, unauthorized("you must be logged in to use settings")
	}

	record, getErr := h.Users.GetSettings(user)
	if getErr != nil {
		return nil, getErr
	}

	var value Settings
	if err := value.UnmarshalJSON(record.Value); err != nil {
		return nil, fmt.Errorf("malformed user settings (user %s): %w", user, err)
	}

	return &SettingsGetOK{Settings: value}, nil
}

func (h *phandler) SettingsPut(ctx context.Context, req *SettingsPutReq) (*SettingsPutOK, error) {
	user, hasUser := getAuthenticatedUser(ctx)
	if !hasUser {
		return nil, unauthorized("you must be logged in to use settings")
	}

	input, marshalErr := req.Settings.MarshalJSON()
	if marshalErr != nil {
		return nil, marshalErr
	}

	updated, updateErr := h.Users.UpdateSettings(prepo.UserSettings{
		UserID: user,
		Value:  input,
	})
	if updateErr != nil {
		return nil, updateErr
	}

	var value Settings
	if err := value.UnmarshalJSON(updated.Value); err != nil {
		return nil, fmt.Errorf("malformed user settings (user %s): %w", user, err)
	}

	return &SettingsPutOK{Settings: value}, nil
}
