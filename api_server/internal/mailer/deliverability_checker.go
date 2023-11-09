package mailer

import "context"

type DeliverabilityChecker interface {
	CheckDeliverable(ctx context.Context, email string) (bool, error)
}

type NoopDeliverabilityChecker struct{}

func (c *NoopDeliverabilityChecker) CheckDeliverable(_ context.Context, _ string) (bool, error) {
	return true, nil
}
