// Code generated by mockery v2.45.0. DO NOT EDIT.

package pflickr

import (
	time "time"

	mock "github.com/stretchr/testify/mock"
)

// MockclockProvider is an autogenerated mock type for the clockProvider type
type MockclockProvider struct {
	mock.Mock
}

type MockclockProvider_Expecter struct {
	mock *mock.Mock
}

func (_m *MockclockProvider) EXPECT() *MockclockProvider_Expecter {
	return &MockclockProvider_Expecter{mock: &_m.Mock}
}

// Now provides a mock function with given fields:
func (_m *MockclockProvider) Now() time.Time {
	ret := _m.Called()

	if len(ret) == 0 {
		panic("no return value specified for Now")
	}

	var r0 time.Time
	if rf, ok := ret.Get(0).(func() time.Time); ok {
		r0 = rf()
	} else {
		r0 = ret.Get(0).(time.Time)
	}

	return r0
}

// MockclockProvider_Now_Call is a *mock.Call that shadows Run/Return methods with type explicit version for method 'Now'
type MockclockProvider_Now_Call struct {
	*mock.Call
}

// Now is a helper method to define mock.On call
func (_e *MockclockProvider_Expecter) Now() *MockclockProvider_Now_Call {
	return &MockclockProvider_Now_Call{Call: _e.mock.On("Now")}
}

func (_c *MockclockProvider_Now_Call) Run(run func()) *MockclockProvider_Now_Call {
	_c.Call.Run(func(args mock.Arguments) {
		run()
	})
	return _c
}

func (_c *MockclockProvider_Now_Call) Return(_a0 time.Time) *MockclockProvider_Now_Call {
	_c.Call.Return(_a0)
	return _c
}

func (_c *MockclockProvider_Now_Call) RunAndReturn(run func() time.Time) *MockclockProvider_Now_Call {
	_c.Call.Return(run)
	return _c
}

// NewMockclockProvider creates a new instance of MockclockProvider. It also registers a testing interface on the mock and a cleanup function to assert the mocks expectations.
// The first argument is typically a *testing.T value.
func NewMockclockProvider(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockclockProvider {
	mock := &MockclockProvider{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}