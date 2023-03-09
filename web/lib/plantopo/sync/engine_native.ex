defmodule PlanTopo.Sync.EngineNative do
  use Rustler, otp_app: :plantopo, crate: "plantopo_sync_engine"

  def message_decode(_data), do: :erlang.nif_error(:nif_not_loaded)
  def message_encode(_value), do: :erlang.nif_error(:nif_not_loaded)
  def message_encoder_new(), do: :erlang.nif_error(:nif_not_loaded)
  def message_encoder_write(_enc, _msg), do: :erlang.nif_error(:nif_not_loaded)
  def message_encoder_finish(_enc), do: :erlang.nif_error(:nif_not_loaded)

  def awareness_update_to_map(_value), do: :erlang.nif_error(:nif_not_loaded)

  def awareness_new(), do: :erlang.nif_error(:nif_not_loaded)
  def apply_update(_aware, _update), do: :erlang.nif_error(:nif_not_loaded)
  def apply_awareness_update(_aware, _update), do: :erlang.nif_error(:nif_not_loaded)
  def serialize_snapshot_if_changed(_aware, _old), do: :erlang.nif_error(:nif_not_loaded)
  def serialize_data(_aware), do: :erlang.nif_error(:nif_not_loaded)
  def encode_awareness_update(_aware), do: :erlang.nif_error(:nif_not_loaded)
  def encode_state_as_update(_aware, _maybe_sv), do: :erlang.nif_error(:nif_not_loaded)
  def encode_intro(_aware, _enc), do: :erlang.nif_error(:nif_not_loaded)
end
