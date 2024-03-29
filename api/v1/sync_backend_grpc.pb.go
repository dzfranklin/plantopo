// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.3.0
// - protoc             v4.25.0
// source: api/v1/sync_backend.proto

package v1

import (
	context "context"
	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
	emptypb "google.golang.org/protobuf/types/known/emptypb"
	structpb "google.golang.org/protobuf/types/known/structpb"
)

// This is a compile-time assertion to ensure that this generated file
// is compatible with the grpc package it is being compiled against.
// Requires gRPC-Go v1.32.0 or later.
const _ = grpc.SupportPackageIsVersion7

const (
	SyncBackend_SetupConnection_FullMethodName = "/SyncBackend/SetupConnection"
	SyncBackend_Connect_FullMethodName         = "/SyncBackend/Connect"
	SyncBackend_Export_FullMethodName          = "/SyncBackend/Export"
	SyncBackend_Import_FullMethodName          = "/SyncBackend/Import"
	SyncBackend_Stats_FullMethodName           = "/SyncBackend/Stats"
)

// SyncBackendClient is the client API for SyncBackend service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type SyncBackendClient interface {
	// SetupConnection is called by the matchmaker to setup a future connection by
	// the frontend
	SetupConnection(ctx context.Context, in *SyncBackendSetupConnectionRequest, opts ...grpc.CallOption) (*SyncBackendSetupConnectionResponse, error)
	// Connect is called by the frontend to connect using a token returned by
	// SetupConnection
	Connect(ctx context.Context, opts ...grpc.CallOption) (SyncBackend_ConnectClient, error)
	Export(ctx context.Context, in *SyncBackendExportRequest, opts ...grpc.CallOption) (*SyncBackendExportResponse, error)
	Import(ctx context.Context, in *SyncBackendImportRequest, opts ...grpc.CallOption) (*SyncBackendImportResponse, error)
	Stats(ctx context.Context, in *emptypb.Empty, opts ...grpc.CallOption) (*structpb.Struct, error)
}

type syncBackendClient struct {
	cc grpc.ClientConnInterface
}

func NewSyncBackendClient(cc grpc.ClientConnInterface) SyncBackendClient {
	return &syncBackendClient{cc}
}

func (c *syncBackendClient) SetupConnection(ctx context.Context, in *SyncBackendSetupConnectionRequest, opts ...grpc.CallOption) (*SyncBackendSetupConnectionResponse, error) {
	out := new(SyncBackendSetupConnectionResponse)
	err := c.cc.Invoke(ctx, SyncBackend_SetupConnection_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *syncBackendClient) Connect(ctx context.Context, opts ...grpc.CallOption) (SyncBackend_ConnectClient, error) {
	stream, err := c.cc.NewStream(ctx, &SyncBackend_ServiceDesc.Streams[0], SyncBackend_Connect_FullMethodName, opts...)
	if err != nil {
		return nil, err
	}
	x := &syncBackendConnectClient{stream}
	return x, nil
}

type SyncBackend_ConnectClient interface {
	Send(*SyncBackendIncomingMessage) error
	Recv() (*SyncBackendOutgoingMessage, error)
	grpc.ClientStream
}

type syncBackendConnectClient struct {
	grpc.ClientStream
}

func (x *syncBackendConnectClient) Send(m *SyncBackendIncomingMessage) error {
	return x.ClientStream.SendMsg(m)
}

func (x *syncBackendConnectClient) Recv() (*SyncBackendOutgoingMessage, error) {
	m := new(SyncBackendOutgoingMessage)
	if err := x.ClientStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

func (c *syncBackendClient) Export(ctx context.Context, in *SyncBackendExportRequest, opts ...grpc.CallOption) (*SyncBackendExportResponse, error) {
	out := new(SyncBackendExportResponse)
	err := c.cc.Invoke(ctx, SyncBackend_Export_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *syncBackendClient) Import(ctx context.Context, in *SyncBackendImportRequest, opts ...grpc.CallOption) (*SyncBackendImportResponse, error) {
	out := new(SyncBackendImportResponse)
	err := c.cc.Invoke(ctx, SyncBackend_Import_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *syncBackendClient) Stats(ctx context.Context, in *emptypb.Empty, opts ...grpc.CallOption) (*structpb.Struct, error) {
	out := new(structpb.Struct)
	err := c.cc.Invoke(ctx, SyncBackend_Stats_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// SyncBackendServer is the server API for SyncBackend service.
// All implementations must embed UnimplementedSyncBackendServer
// for forward compatibility
type SyncBackendServer interface {
	// SetupConnection is called by the matchmaker to setup a future connection by
	// the frontend
	SetupConnection(context.Context, *SyncBackendSetupConnectionRequest) (*SyncBackendSetupConnectionResponse, error)
	// Connect is called by the frontend to connect using a token returned by
	// SetupConnection
	Connect(SyncBackend_ConnectServer) error
	Export(context.Context, *SyncBackendExportRequest) (*SyncBackendExportResponse, error)
	Import(context.Context, *SyncBackendImportRequest) (*SyncBackendImportResponse, error)
	Stats(context.Context, *emptypb.Empty) (*structpb.Struct, error)
	mustEmbedUnimplementedSyncBackendServer()
}

// UnimplementedSyncBackendServer must be embedded to have forward compatible implementations.
type UnimplementedSyncBackendServer struct {
}

func (UnimplementedSyncBackendServer) SetupConnection(context.Context, *SyncBackendSetupConnectionRequest) (*SyncBackendSetupConnectionResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SetupConnection not implemented")
}
func (UnimplementedSyncBackendServer) Connect(SyncBackend_ConnectServer) error {
	return status.Errorf(codes.Unimplemented, "method Connect not implemented")
}
func (UnimplementedSyncBackendServer) Export(context.Context, *SyncBackendExportRequest) (*SyncBackendExportResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Export not implemented")
}
func (UnimplementedSyncBackendServer) Import(context.Context, *SyncBackendImportRequest) (*SyncBackendImportResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Import not implemented")
}
func (UnimplementedSyncBackendServer) Stats(context.Context, *emptypb.Empty) (*structpb.Struct, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Stats not implemented")
}
func (UnimplementedSyncBackendServer) mustEmbedUnimplementedSyncBackendServer() {}

// UnsafeSyncBackendServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to SyncBackendServer will
// result in compilation errors.
type UnsafeSyncBackendServer interface {
	mustEmbedUnimplementedSyncBackendServer()
}

func RegisterSyncBackendServer(s grpc.ServiceRegistrar, srv SyncBackendServer) {
	s.RegisterService(&SyncBackend_ServiceDesc, srv)
}

func _SyncBackend_SetupConnection_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SyncBackendSetupConnectionRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SyncBackendServer).SetupConnection(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: SyncBackend_SetupConnection_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SyncBackendServer).SetupConnection(ctx, req.(*SyncBackendSetupConnectionRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _SyncBackend_Connect_Handler(srv interface{}, stream grpc.ServerStream) error {
	return srv.(SyncBackendServer).Connect(&syncBackendConnectServer{stream})
}

type SyncBackend_ConnectServer interface {
	Send(*SyncBackendOutgoingMessage) error
	Recv() (*SyncBackendIncomingMessage, error)
	grpc.ServerStream
}

type syncBackendConnectServer struct {
	grpc.ServerStream
}

func (x *syncBackendConnectServer) Send(m *SyncBackendOutgoingMessage) error {
	return x.ServerStream.SendMsg(m)
}

func (x *syncBackendConnectServer) Recv() (*SyncBackendIncomingMessage, error) {
	m := new(SyncBackendIncomingMessage)
	if err := x.ServerStream.RecvMsg(m); err != nil {
		return nil, err
	}
	return m, nil
}

func _SyncBackend_Export_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SyncBackendExportRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SyncBackendServer).Export(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: SyncBackend_Export_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SyncBackendServer).Export(ctx, req.(*SyncBackendExportRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _SyncBackend_Import_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(SyncBackendImportRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SyncBackendServer).Import(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: SyncBackend_Import_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SyncBackendServer).Import(ctx, req.(*SyncBackendImportRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _SyncBackend_Stats_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(emptypb.Empty)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(SyncBackendServer).Stats(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: SyncBackend_Stats_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(SyncBackendServer).Stats(ctx, req.(*emptypb.Empty))
	}
	return interceptor(ctx, in, info, handler)
}

// SyncBackend_ServiceDesc is the grpc.ServiceDesc for SyncBackend service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var SyncBackend_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "SyncBackend",
	HandlerType: (*SyncBackendServer)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "SetupConnection",
			Handler:    _SyncBackend_SetupConnection_Handler,
		},
		{
			MethodName: "Export",
			Handler:    _SyncBackend_Export_Handler,
		},
		{
			MethodName: "Import",
			Handler:    _SyncBackend_Import_Handler,
		},
		{
			MethodName: "Stats",
			Handler:    _SyncBackend_Stats_Handler,
		},
	},
	Streams: []grpc.StreamDesc{
		{
			StreamName:    "Connect",
			Handler:       _SyncBackend_Connect_Handler,
			ServerStreams: true,
			ClientStreams: true,
		},
	},
	Metadata: "api/v1/sync_backend.proto",
}
