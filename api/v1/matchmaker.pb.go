// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.28.1
// 	protoc        v3.12.4
// source: api/v1/matchmaker.proto

package v1

import (
	empty "github.com/golang/protobuf/ptypes/empty"
	_struct "github.com/golang/protobuf/ptypes/struct"
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
)

const (
	// Verify that this generated code is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	// Verify that runtime/protoimpl is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

type MatchmakerSetupConnectionRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	MapId string `protobuf:"bytes,1,opt,name=map_id,json=mapId,proto3" json:"map_id,omitempty"`
}

func (x *MatchmakerSetupConnectionRequest) Reset() {
	*x = MatchmakerSetupConnectionRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_v1_matchmaker_proto_msgTypes[0]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *MatchmakerSetupConnectionRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*MatchmakerSetupConnectionRequest) ProtoMessage() {}

func (x *MatchmakerSetupConnectionRequest) ProtoReflect() protoreflect.Message {
	mi := &file_api_v1_matchmaker_proto_msgTypes[0]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use MatchmakerSetupConnectionRequest.ProtoReflect.Descriptor instead.
func (*MatchmakerSetupConnectionRequest) Descriptor() ([]byte, []int) {
	return file_api_v1_matchmaker_proto_rawDescGZIP(), []int{0}
}

func (x *MatchmakerSetupConnectionRequest) GetMapId() string {
	if x != nil {
		return x.MapId
	}
	return ""
}

type MatchmakerSetupConnectionResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Backend string `protobuf:"bytes,1,opt,name=backend,proto3" json:"backend,omitempty"`
	Token   string `protobuf:"bytes,2,opt,name=token,proto3" json:"token,omitempty"`
}

func (x *MatchmakerSetupConnectionResponse) Reset() {
	*x = MatchmakerSetupConnectionResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_v1_matchmaker_proto_msgTypes[1]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *MatchmakerSetupConnectionResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*MatchmakerSetupConnectionResponse) ProtoMessage() {}

func (x *MatchmakerSetupConnectionResponse) ProtoReflect() protoreflect.Message {
	mi := &file_api_v1_matchmaker_proto_msgTypes[1]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use MatchmakerSetupConnectionResponse.ProtoReflect.Descriptor instead.
func (*MatchmakerSetupConnectionResponse) Descriptor() ([]byte, []int) {
	return file_api_v1_matchmaker_proto_rawDescGZIP(), []int{1}
}

func (x *MatchmakerSetupConnectionResponse) GetBackend() string {
	if x != nil {
		return x.Backend
	}
	return ""
}

func (x *MatchmakerSetupConnectionResponse) GetToken() string {
	if x != nil {
		return x.Token
	}
	return ""
}

type MatchmakerRegisterBackendRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Backend string `protobuf:"bytes,1,opt,name=backend,proto3" json:"backend,omitempty"`
}

func (x *MatchmakerRegisterBackendRequest) Reset() {
	*x = MatchmakerRegisterBackendRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_v1_matchmaker_proto_msgTypes[2]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *MatchmakerRegisterBackendRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*MatchmakerRegisterBackendRequest) ProtoMessage() {}

func (x *MatchmakerRegisterBackendRequest) ProtoReflect() protoreflect.Message {
	mi := &file_api_v1_matchmaker_proto_msgTypes[2]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use MatchmakerRegisterBackendRequest.ProtoReflect.Descriptor instead.
func (*MatchmakerRegisterBackendRequest) Descriptor() ([]byte, []int) {
	return file_api_v1_matchmaker_proto_rawDescGZIP(), []int{2}
}

func (x *MatchmakerRegisterBackendRequest) GetBackend() string {
	if x != nil {
		return x.Backend
	}
	return ""
}

type MatchmakerRegisterBackendResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields
}

func (x *MatchmakerRegisterBackendResponse) Reset() {
	*x = MatchmakerRegisterBackendResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_v1_matchmaker_proto_msgTypes[3]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *MatchmakerRegisterBackendResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*MatchmakerRegisterBackendResponse) ProtoMessage() {}

func (x *MatchmakerRegisterBackendResponse) ProtoReflect() protoreflect.Message {
	mi := &file_api_v1_matchmaker_proto_msgTypes[3]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use MatchmakerRegisterBackendResponse.ProtoReflect.Descriptor instead.
func (*MatchmakerRegisterBackendResponse) Descriptor() ([]byte, []int) {
	return file_api_v1_matchmaker_proto_rawDescGZIP(), []int{3}
}

type MatchmakerUnregisterBackendRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Backend string `protobuf:"bytes,1,opt,name=backend,proto3" json:"backend,omitempty"`
}

func (x *MatchmakerUnregisterBackendRequest) Reset() {
	*x = MatchmakerUnregisterBackendRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_v1_matchmaker_proto_msgTypes[4]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *MatchmakerUnregisterBackendRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*MatchmakerUnregisterBackendRequest) ProtoMessage() {}

func (x *MatchmakerUnregisterBackendRequest) ProtoReflect() protoreflect.Message {
	mi := &file_api_v1_matchmaker_proto_msgTypes[4]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use MatchmakerUnregisterBackendRequest.ProtoReflect.Descriptor instead.
func (*MatchmakerUnregisterBackendRequest) Descriptor() ([]byte, []int) {
	return file_api_v1_matchmaker_proto_rawDescGZIP(), []int{4}
}

func (x *MatchmakerUnregisterBackendRequest) GetBackend() string {
	if x != nil {
		return x.Backend
	}
	return ""
}

type MatchmakerUnregisterBackendResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields
}

func (x *MatchmakerUnregisterBackendResponse) Reset() {
	*x = MatchmakerUnregisterBackendResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_v1_matchmaker_proto_msgTypes[5]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *MatchmakerUnregisterBackendResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*MatchmakerUnregisterBackendResponse) ProtoMessage() {}

func (x *MatchmakerUnregisterBackendResponse) ProtoReflect() protoreflect.Message {
	mi := &file_api_v1_matchmaker_proto_msgTypes[5]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use MatchmakerUnregisterBackendResponse.ProtoReflect.Descriptor instead.
func (*MatchmakerUnregisterBackendResponse) Descriptor() ([]byte, []int) {
	return file_api_v1_matchmaker_proto_rawDescGZIP(), []int{5}
}

type MatchmakerRegisterCloseRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Backend string `protobuf:"bytes,1,opt,name=backend,proto3" json:"backend,omitempty"`
	MapId   string `protobuf:"bytes,2,opt,name=map_id,json=mapId,proto3" json:"map_id,omitempty"`
}

func (x *MatchmakerRegisterCloseRequest) Reset() {
	*x = MatchmakerRegisterCloseRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_v1_matchmaker_proto_msgTypes[6]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *MatchmakerRegisterCloseRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*MatchmakerRegisterCloseRequest) ProtoMessage() {}

func (x *MatchmakerRegisterCloseRequest) ProtoReflect() protoreflect.Message {
	mi := &file_api_v1_matchmaker_proto_msgTypes[6]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use MatchmakerRegisterCloseRequest.ProtoReflect.Descriptor instead.
func (*MatchmakerRegisterCloseRequest) Descriptor() ([]byte, []int) {
	return file_api_v1_matchmaker_proto_rawDescGZIP(), []int{6}
}

func (x *MatchmakerRegisterCloseRequest) GetBackend() string {
	if x != nil {
		return x.Backend
	}
	return ""
}

func (x *MatchmakerRegisterCloseRequest) GetMapId() string {
	if x != nil {
		return x.MapId
	}
	return ""
}

type MatchmakerRegisterCloseResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields
}

func (x *MatchmakerRegisterCloseResponse) Reset() {
	*x = MatchmakerRegisterCloseResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_v1_matchmaker_proto_msgTypes[7]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *MatchmakerRegisterCloseResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*MatchmakerRegisterCloseResponse) ProtoMessage() {}

func (x *MatchmakerRegisterCloseResponse) ProtoReflect() protoreflect.Message {
	mi := &file_api_v1_matchmaker_proto_msgTypes[7]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use MatchmakerRegisterCloseResponse.ProtoReflect.Descriptor instead.
func (*MatchmakerRegisterCloseResponse) Descriptor() ([]byte, []int) {
	return file_api_v1_matchmaker_proto_rawDescGZIP(), []int{7}
}

var File_api_v1_matchmaker_proto protoreflect.FileDescriptor

var file_api_v1_matchmaker_proto_rawDesc = []byte{
	0x0a, 0x17, 0x61, 0x70, 0x69, 0x2f, 0x76, 0x31, 0x2f, 0x6d, 0x61, 0x74, 0x63, 0x68, 0x6d, 0x61,
	0x6b, 0x65, 0x72, 0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x1a, 0x1b, 0x67, 0x6f, 0x6f, 0x67, 0x6c,
	0x65, 0x2f, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x62, 0x75, 0x66, 0x2f, 0x65, 0x6d, 0x70, 0x74, 0x79,
	0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x1a, 0x1c, 0x67, 0x6f, 0x6f, 0x67, 0x6c, 0x65, 0x2f, 0x70,
	0x72, 0x6f, 0x74, 0x6f, 0x62, 0x75, 0x66, 0x2f, 0x73, 0x74, 0x72, 0x75, 0x63, 0x74, 0x2e, 0x70,
	0x72, 0x6f, 0x74, 0x6f, 0x22, 0x39, 0x0a, 0x20, 0x4d, 0x61, 0x74, 0x63, 0x68, 0x6d, 0x61, 0x6b,
	0x65, 0x72, 0x53, 0x65, 0x74, 0x75, 0x70, 0x43, 0x6f, 0x6e, 0x6e, 0x65, 0x63, 0x74, 0x69, 0x6f,
	0x6e, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x12, 0x15, 0x0a, 0x06, 0x6d, 0x61, 0x70, 0x5f,
	0x69, 0x64, 0x18, 0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x05, 0x6d, 0x61, 0x70, 0x49, 0x64, 0x22,
	0x53, 0x0a, 0x21, 0x4d, 0x61, 0x74, 0x63, 0x68, 0x6d, 0x61, 0x6b, 0x65, 0x72, 0x53, 0x65, 0x74,
	0x75, 0x70, 0x43, 0x6f, 0x6e, 0x6e, 0x65, 0x63, 0x74, 0x69, 0x6f, 0x6e, 0x52, 0x65, 0x73, 0x70,
	0x6f, 0x6e, 0x73, 0x65, 0x12, 0x18, 0x0a, 0x07, 0x62, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x18,
	0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x07, 0x62, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x12, 0x14,
	0x0a, 0x05, 0x74, 0x6f, 0x6b, 0x65, 0x6e, 0x18, 0x02, 0x20, 0x01, 0x28, 0x09, 0x52, 0x05, 0x74,
	0x6f, 0x6b, 0x65, 0x6e, 0x22, 0x3c, 0x0a, 0x20, 0x4d, 0x61, 0x74, 0x63, 0x68, 0x6d, 0x61, 0x6b,
	0x65, 0x72, 0x52, 0x65, 0x67, 0x69, 0x73, 0x74, 0x65, 0x72, 0x42, 0x61, 0x63, 0x6b, 0x65, 0x6e,
	0x64, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x12, 0x18, 0x0a, 0x07, 0x62, 0x61, 0x63, 0x6b,
	0x65, 0x6e, 0x64, 0x18, 0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x07, 0x62, 0x61, 0x63, 0x6b, 0x65,
	0x6e, 0x64, 0x22, 0x23, 0x0a, 0x21, 0x4d, 0x61, 0x74, 0x63, 0x68, 0x6d, 0x61, 0x6b, 0x65, 0x72,
	0x52, 0x65, 0x67, 0x69, 0x73, 0x74, 0x65, 0x72, 0x42, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x52,
	0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x22, 0x3e, 0x0a, 0x22, 0x4d, 0x61, 0x74, 0x63, 0x68,
	0x6d, 0x61, 0x6b, 0x65, 0x72, 0x55, 0x6e, 0x72, 0x65, 0x67, 0x69, 0x73, 0x74, 0x65, 0x72, 0x42,
	0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x12, 0x18, 0x0a,
	0x07, 0x62, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x18, 0x01, 0x20, 0x01, 0x28, 0x09, 0x52, 0x07,
	0x62, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x22, 0x25, 0x0a, 0x23, 0x4d, 0x61, 0x74, 0x63, 0x68,
	0x6d, 0x61, 0x6b, 0x65, 0x72, 0x55, 0x6e, 0x72, 0x65, 0x67, 0x69, 0x73, 0x74, 0x65, 0x72, 0x42,
	0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x22, 0x51,
	0x0a, 0x1e, 0x4d, 0x61, 0x74, 0x63, 0x68, 0x6d, 0x61, 0x6b, 0x65, 0x72, 0x52, 0x65, 0x67, 0x69,
	0x73, 0x74, 0x65, 0x72, 0x43, 0x6c, 0x6f, 0x73, 0x65, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74,
	0x12, 0x18, 0x0a, 0x07, 0x62, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x18, 0x01, 0x20, 0x01, 0x28,
	0x09, 0x52, 0x07, 0x62, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x12, 0x15, 0x0a, 0x06, 0x6d, 0x61,
	0x70, 0x5f, 0x69, 0x64, 0x18, 0x02, 0x20, 0x01, 0x28, 0x09, 0x52, 0x05, 0x6d, 0x61, 0x70, 0x49,
	0x64, 0x22, 0x21, 0x0a, 0x1f, 0x4d, 0x61, 0x74, 0x63, 0x68, 0x6d, 0x61, 0x6b, 0x65, 0x72, 0x52,
	0x65, 0x67, 0x69, 0x73, 0x74, 0x65, 0x72, 0x43, 0x6c, 0x6f, 0x73, 0x65, 0x52, 0x65, 0x73, 0x70,
	0x6f, 0x6e, 0x73, 0x65, 0x32, 0xed, 0x03, 0x0a, 0x0a, 0x4d, 0x61, 0x74, 0x63, 0x68, 0x6d, 0x61,
	0x6b, 0x65, 0x72, 0x12, 0x58, 0x0a, 0x0f, 0x53, 0x65, 0x74, 0x75, 0x70, 0x43, 0x6f, 0x6e, 0x6e,
	0x65, 0x63, 0x74, 0x69, 0x6f, 0x6e, 0x12, 0x21, 0x2e, 0x4d, 0x61, 0x74, 0x63, 0x68, 0x6d, 0x61,
	0x6b, 0x65, 0x72, 0x53, 0x65, 0x74, 0x75, 0x70, 0x43, 0x6f, 0x6e, 0x6e, 0x65, 0x63, 0x74, 0x69,
	0x6f, 0x6e, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x1a, 0x22, 0x2e, 0x4d, 0x61, 0x74, 0x63,
	0x68, 0x6d, 0x61, 0x6b, 0x65, 0x72, 0x53, 0x65, 0x74, 0x75, 0x70, 0x43, 0x6f, 0x6e, 0x6e, 0x65,
	0x63, 0x74, 0x69, 0x6f, 0x6e, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x12, 0x58, 0x0a,
	0x0f, 0x52, 0x65, 0x67, 0x69, 0x73, 0x74, 0x65, 0x72, 0x42, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64,
	0x12, 0x21, 0x2e, 0x4d, 0x61, 0x74, 0x63, 0x68, 0x6d, 0x61, 0x6b, 0x65, 0x72, 0x52, 0x65, 0x67,
	0x69, 0x73, 0x74, 0x65, 0x72, 0x42, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x52, 0x65, 0x71, 0x75,
	0x65, 0x73, 0x74, 0x1a, 0x22, 0x2e, 0x4d, 0x61, 0x74, 0x63, 0x68, 0x6d, 0x61, 0x6b, 0x65, 0x72,
	0x52, 0x65, 0x67, 0x69, 0x73, 0x74, 0x65, 0x72, 0x42, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x52,
	0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x12, 0x5e, 0x0a, 0x11, 0x55, 0x6e, 0x72, 0x65, 0x67,
	0x69, 0x73, 0x74, 0x65, 0x72, 0x42, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x12, 0x23, 0x2e, 0x4d,
	0x61, 0x74, 0x63, 0x68, 0x6d, 0x61, 0x6b, 0x65, 0x72, 0x55, 0x6e, 0x72, 0x65, 0x67, 0x69, 0x73,
	0x74, 0x65, 0x72, 0x42, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73,
	0x74, 0x1a, 0x24, 0x2e, 0x4d, 0x61, 0x74, 0x63, 0x68, 0x6d, 0x61, 0x6b, 0x65, 0x72, 0x55, 0x6e,
	0x72, 0x65, 0x67, 0x69, 0x73, 0x74, 0x65, 0x72, 0x42, 0x61, 0x63, 0x6b, 0x65, 0x6e, 0x64, 0x52,
	0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x12, 0x52, 0x0a, 0x0d, 0x52, 0x65, 0x67, 0x69, 0x73,
	0x74, 0x65, 0x72, 0x43, 0x6c, 0x6f, 0x73, 0x65, 0x12, 0x1f, 0x2e, 0x4d, 0x61, 0x74, 0x63, 0x68,
	0x6d, 0x61, 0x6b, 0x65, 0x72, 0x52, 0x65, 0x67, 0x69, 0x73, 0x74, 0x65, 0x72, 0x43, 0x6c, 0x6f,
	0x73, 0x65, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x1a, 0x20, 0x2e, 0x4d, 0x61, 0x74, 0x63,
	0x68, 0x6d, 0x61, 0x6b, 0x65, 0x72, 0x52, 0x65, 0x67, 0x69, 0x73, 0x74, 0x65, 0x72, 0x43, 0x6c,
	0x6f, 0x73, 0x65, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x12, 0x38, 0x0a, 0x05, 0x53,
	0x74, 0x61, 0x74, 0x73, 0x12, 0x16, 0x2e, 0x67, 0x6f, 0x6f, 0x67, 0x6c, 0x65, 0x2e, 0x70, 0x72,
	0x6f, 0x74, 0x6f, 0x62, 0x75, 0x66, 0x2e, 0x45, 0x6d, 0x70, 0x74, 0x79, 0x1a, 0x17, 0x2e, 0x67,
	0x6f, 0x6f, 0x67, 0x6c, 0x65, 0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x62, 0x75, 0x66, 0x2e, 0x53,
	0x74, 0x72, 0x75, 0x63, 0x74, 0x12, 0x3d, 0x0a, 0x0a, 0x44, 0x65, 0x62, 0x75, 0x67, 0x53, 0x74,
	0x61, 0x74, 0x65, 0x12, 0x16, 0x2e, 0x67, 0x6f, 0x6f, 0x67, 0x6c, 0x65, 0x2e, 0x70, 0x72, 0x6f,
	0x74, 0x6f, 0x62, 0x75, 0x66, 0x2e, 0x45, 0x6d, 0x70, 0x74, 0x79, 0x1a, 0x17, 0x2e, 0x67, 0x6f,
	0x6f, 0x67, 0x6c, 0x65, 0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x62, 0x75, 0x66, 0x2e, 0x53, 0x74,
	0x72, 0x75, 0x63, 0x74, 0x42, 0x2c, 0x5a, 0x2a, 0x67, 0x69, 0x74, 0x68, 0x75, 0x62, 0x2e, 0x63,
	0x6f, 0x6d, 0x2f, 0x64, 0x61, 0x6e, 0x69, 0x65, 0x6c, 0x7a, 0x66, 0x72, 0x61, 0x6e, 0x6b, 0x6c,
	0x69, 0x6e, 0x2f, 0x70, 0x6c, 0x61, 0x6e, 0x74, 0x6f, 0x70, 0x6f, 0x2f, 0x61, 0x70, 0x69, 0x2f,
	0x76, 0x31, 0x62, 0x06, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x33,
}

var (
	file_api_v1_matchmaker_proto_rawDescOnce sync.Once
	file_api_v1_matchmaker_proto_rawDescData = file_api_v1_matchmaker_proto_rawDesc
)

func file_api_v1_matchmaker_proto_rawDescGZIP() []byte {
	file_api_v1_matchmaker_proto_rawDescOnce.Do(func() {
		file_api_v1_matchmaker_proto_rawDescData = protoimpl.X.CompressGZIP(file_api_v1_matchmaker_proto_rawDescData)
	})
	return file_api_v1_matchmaker_proto_rawDescData
}

var file_api_v1_matchmaker_proto_msgTypes = make([]protoimpl.MessageInfo, 8)
var file_api_v1_matchmaker_proto_goTypes = []interface{}{
	(*MatchmakerSetupConnectionRequest)(nil),    // 0: MatchmakerSetupConnectionRequest
	(*MatchmakerSetupConnectionResponse)(nil),   // 1: MatchmakerSetupConnectionResponse
	(*MatchmakerRegisterBackendRequest)(nil),    // 2: MatchmakerRegisterBackendRequest
	(*MatchmakerRegisterBackendResponse)(nil),   // 3: MatchmakerRegisterBackendResponse
	(*MatchmakerUnregisterBackendRequest)(nil),  // 4: MatchmakerUnregisterBackendRequest
	(*MatchmakerUnregisterBackendResponse)(nil), // 5: MatchmakerUnregisterBackendResponse
	(*MatchmakerRegisterCloseRequest)(nil),      // 6: MatchmakerRegisterCloseRequest
	(*MatchmakerRegisterCloseResponse)(nil),     // 7: MatchmakerRegisterCloseResponse
	(*empty.Empty)(nil),                         // 8: google.protobuf.Empty
	(*_struct.Struct)(nil),                      // 9: google.protobuf.Struct
}
var file_api_v1_matchmaker_proto_depIdxs = []int32{
	0, // 0: Matchmaker.SetupConnection:input_type -> MatchmakerSetupConnectionRequest
	2, // 1: Matchmaker.RegisterBackend:input_type -> MatchmakerRegisterBackendRequest
	4, // 2: Matchmaker.UnregisterBackend:input_type -> MatchmakerUnregisterBackendRequest
	6, // 3: Matchmaker.RegisterClose:input_type -> MatchmakerRegisterCloseRequest
	8, // 4: Matchmaker.Stats:input_type -> google.protobuf.Empty
	8, // 5: Matchmaker.DebugState:input_type -> google.protobuf.Empty
	1, // 6: Matchmaker.SetupConnection:output_type -> MatchmakerSetupConnectionResponse
	3, // 7: Matchmaker.RegisterBackend:output_type -> MatchmakerRegisterBackendResponse
	5, // 8: Matchmaker.UnregisterBackend:output_type -> MatchmakerUnregisterBackendResponse
	7, // 9: Matchmaker.RegisterClose:output_type -> MatchmakerRegisterCloseResponse
	9, // 10: Matchmaker.Stats:output_type -> google.protobuf.Struct
	9, // 11: Matchmaker.DebugState:output_type -> google.protobuf.Struct
	6, // [6:12] is the sub-list for method output_type
	0, // [0:6] is the sub-list for method input_type
	0, // [0:0] is the sub-list for extension type_name
	0, // [0:0] is the sub-list for extension extendee
	0, // [0:0] is the sub-list for field type_name
}

func init() { file_api_v1_matchmaker_proto_init() }
func file_api_v1_matchmaker_proto_init() {
	if File_api_v1_matchmaker_proto != nil {
		return
	}
	if !protoimpl.UnsafeEnabled {
		file_api_v1_matchmaker_proto_msgTypes[0].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*MatchmakerSetupConnectionRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_api_v1_matchmaker_proto_msgTypes[1].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*MatchmakerSetupConnectionResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_api_v1_matchmaker_proto_msgTypes[2].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*MatchmakerRegisterBackendRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_api_v1_matchmaker_proto_msgTypes[3].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*MatchmakerRegisterBackendResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_api_v1_matchmaker_proto_msgTypes[4].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*MatchmakerUnregisterBackendRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_api_v1_matchmaker_proto_msgTypes[5].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*MatchmakerUnregisterBackendResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_api_v1_matchmaker_proto_msgTypes[6].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*MatchmakerRegisterCloseRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_api_v1_matchmaker_proto_msgTypes[7].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*MatchmakerRegisterCloseResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
	}
	type x struct{}
	out := protoimpl.TypeBuilder{
		File: protoimpl.DescBuilder{
			GoPackagePath: reflect.TypeOf(x{}).PkgPath(),
			RawDescriptor: file_api_v1_matchmaker_proto_rawDesc,
			NumEnums:      0,
			NumMessages:   8,
			NumExtensions: 0,
			NumServices:   1,
		},
		GoTypes:           file_api_v1_matchmaker_proto_goTypes,
		DependencyIndexes: file_api_v1_matchmaker_proto_depIdxs,
		MessageInfos:      file_api_v1_matchmaker_proto_msgTypes,
	}.Build()
	File_api_v1_matchmaker_proto = out.File
	file_api_v1_matchmaker_proto_rawDesc = nil
	file_api_v1_matchmaker_proto_goTypes = nil
	file_api_v1_matchmaker_proto_depIdxs = nil
}