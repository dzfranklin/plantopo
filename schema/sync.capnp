@0xc43847a2898d40ee;

using Core = import "core.capnp";
using Map = import "map.capnp".Map;

struct SyncMessage {
  lts @0 :Core.LInstant; # Optional. Logical timestamp when the message was sent.
  pts @1 :Core.PInstant; # Required. Physical timestamp when the message was sent.

  union {
    requestOpen @2 :RequestOpen;
    acceptOpen @3 :AcceptOpen;
    update @4 :Update; # Sent by anybody at any time
    confirmUpdate @5 :ConfirmUpdate; # Sent by server only
    disconnected @6 :Core.ClientId; # Sent by the server to inform other clients you disconnected
  }

  struct RequestOpen {
    map @1  :Core.MapId; # Required
    token @0 :Text; # Required

    client @2 :Core.ClientId;
    # You'll be assigned a new id if omitted. Client is responsible for ensuring
    # there are never concurrent sessions with the same (map, client)
  }

  struct AcceptOpen {
    allocatedClientId @0 :Core.ClientId; # Set if client was ommitted in response
    write @1 :Bool; # Whether the user is permitted to write
    ipCoords @2 :Core.LngLat;
    update @3 :Update;
  }

  struct Update {
    map @0 :Map;
  }

  struct ConfirmUpdate {
    clock @0 :Core.LInstant;
  }
}

enum ErrorCode {
  # When used as WebSocket closed codes add 3000 to the numeric value
  unset @0;
  badRequest @1;
  forbidden @2;
  tokenExpired @3; # Retry your request with a fresh token
  internalServerError @4; # Retry your request
  unavailable @5;
}
