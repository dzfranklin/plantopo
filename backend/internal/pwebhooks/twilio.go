package pwebhooks

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pweather"
	"github.com/riverqueue/river"
	"github.com/twilio/twilio-go"
	twilioclient "github.com/twilio/twilio-go/client"
	twilioapi "github.com/twilio/twilio-go/rest/api/v2010"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

const QueueTwilio = "twilio"

const twilioWebhookHost = "prin.reindeer-neon.ts.net"

type TwilioJobArgs struct {
	Webhook string
	Params  map[string]string
}

func (TwilioJobArgs) Kind() string {
	return "twilio_webhook"
}

func (TwilioJobArgs) InsertOpts() river.InsertOpts {
	return river.InsertOpts{
		Queue: QueueTwilio,
		UniqueOpts: river.UniqueOpts{
			ByArgs: true,
		},
	}
}

type TwilioWorker struct {
	l       *slog.Logger
	tw      *twilio.RestClient
	weather *pweather.Service
	repo    *prepo.Repo
	river.WorkerDefaults[TwilioJobArgs]
}

func NewTwilioWorker(env *pconfig.Env, repo *prepo.Repo) *TwilioWorker {
	return &TwilioWorker{
		l:       env.Logger,
		tw:      twilio.NewRestClient(),
		weather: pweather.New(env),
		repo:    repo,
	}
}

func (w *TwilioWorker) Work(ctx context.Context, job *river.Job[TwilioJobArgs]) error {
	switch job.Args.Webhook {
	case "incoming-message":
		from := job.Args.Params["From"]
		to := job.Args.Params["To"]
		body := parseIncomingMessageBody(job.Args.Params["Body"])

		w.l.Info("received incoming message", "from", from, "to", to, "body", body)

		isAuthz, err := w.repo.AuthorizedSMSSenders.Check(from)
		if err != nil {
			return err
		}
		if !isAuthz {
			w.l.Info("received message from sender without authorization", "from", from, "body", body)
			return nil
		}

		switch body.command {
		case "weather":
			msg, err := w.weather.FindUKShortForecast(ctx, body.rest)
			if err != nil {
				return err
			}

			tParams := &twilioapi.CreateMessageParams{}
			tParams.SetFrom(to)
			tParams.SetTo(from)
			tParams.SetBody(msg)
			_, err = w.tw.Api.CreateMessage(tParams)
			if err != nil {
				return err
			}
		default:
			w.l.Info("unrecognized command", "command", body.command)
		}
	default:
		w.l.Warn("unhandled twilio webhook", "webhook", job.Args.Webhook)
	}
	return nil
}

func (h *phandler) twilioHandler(w http.ResponseWriter, r *http.Request) {
	webhook := r.PathValue("webhook")
	if webhook == "" {
		panic("missing path value")
	}

	reqBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	urlToValidate := *r.URL
	urlToValidate.Scheme = "https"
	urlToValidate.Host = twilioWebhookHost

	signatureToValidate := r.Header.Get("X-Twilio-Signature")
	if signatureToValidate == "" {
		h.Logger.Warn("missing signature to validate")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	validator := twilioclient.NewRequestValidator(h.Env.Config.Twilio.AuthToken)
	if !validator.ValidateBody(urlToValidate.String(), reqBody, signatureToValidate) {
		h.Logger.Warn("twilio webhook request failed validation")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	rawParams, err := url.ParseQuery(string(reqBody))
	if err != nil {
		h.Logger.Warn("failed to parse reqBody", "err", err.Error())
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	params := make(map[string]string)
	for k, vs := range rawParams {
		params[k] = vs[0]
	}

	_, err = h.Jobs.Insert(context.Background(), TwilioJobArgs{
		Webhook: webhook,
		Params:  params,
	}, nil)
	if err != nil {
		h.Logger.Error("failed to insert river job for twilio webhook", "err", err.Error())
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

type incomingMessageParts struct {
	command            string
	rest               string
	inreachCoordinates [2]float64
}

var inreachBodyRe = regexp.MustCompile(`^(.*) inreachlink\.com/.*? \(([+-]?(?:[0-9]*[.])?[0-9]+), ([+-]?(?:[0-9]*[.])?[0-9]+)\).*$`)

func parseIncomingMessageBody(body string) incomingMessageParts {
	parts := incomingMessageParts{}
	inreachMatches := inreachBodyRe.FindStringSubmatch(body)
	if inreachMatches != nil {
		bodyPart := inreachMatches[1]
		latPart := inreachMatches[2]
		lngPart := inreachMatches[3]

		lng, lngErr := strconv.ParseFloat(lngPart, 64)
		lat, latErr := strconv.ParseFloat(latPart, 64)

		if lngErr == nil && latErr == nil {
			body = bodyPart
			parts.inreachCoordinates = [2]float64{lng, lat}
		}
	}

	commandAndRest := strings.SplitN(strings.TrimSpace(body), " ", 2)
	parts.command = strings.ToLower(strings.TrimSpace(commandAndRest[0]))
	parts.rest = strings.TrimSpace(commandAndRest[1])

	return parts
}
