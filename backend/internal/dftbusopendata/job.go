package busopendata

const (
	bucket = "dft-bus-open-data"
)

type JobArgs struct{}

func (JobArgs) Kind() string {
	return "dft_bus_open_data"
}
