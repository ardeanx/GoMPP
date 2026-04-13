package handler

import "testing"

func BenchmarkIsValidEmail(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		isValidEmail("user@example.com")
	}
}

func BenchmarkIsValidEmail_Invalid(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		isValidEmail("not-an-email")
	}
}

func BenchmarkIsValidUsername(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		isValidUsername("john_doe-123")
	}
}

func BenchmarkIsValidWebhookURL(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		isValidWebhookURL("https://hooks.example.com/webhook/abc123")
	}
}

func TestIsValidEmail(t *testing.T) {
	tests := []struct {
		email string
		want  bool
	}{
		{"user@example.com", true},
		{"user+tag@example.co.uk", true},
		{"a@b.cd", true},
		{"", false},
		{"noatsign", false},
		{"@nodomain.com", false},
		{"user@", false},
		{"user@.com", false},
	}
	for _, tt := range tests {
		if got := isValidEmail(tt.email); got != tt.want {
			t.Errorf("isValidEmail(%q) = %v, want %v", tt.email, got, tt.want)
		}
	}
}

func TestIsValidUsername(t *testing.T) {
	tests := []struct {
		name string
		want bool
	}{
		{"john", true},
		{"john_doe-123", true},
		{"ab", false},        // too short
		{"a", false},         // too short
		{"user name", false}, // space
		{"user@name", false}, // special char
	}
	for _, tt := range tests {
		if got := isValidUsername(tt.name); got != tt.want {
			t.Errorf("isValidUsername(%q) = %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestIsValidWebhookURL(t *testing.T) {
	tests := []struct {
		url  string
		want bool
	}{
		{"https://hooks.example.com/webhook", true},
		{"http://external.service.io/path", true},
		{"", false},
		{"ftp://example.com", false},
		{"not-a-url", false},
		{"http://localhost:8080/hook", false},
		{"http://127.0.0.1/hook", false},
		{"http://192.168.1.1/hook", false},
		{"http://10.0.0.1/hook", false},
	}
	for _, tt := range tests {
		if got := isValidWebhookURL(tt.url); got != tt.want {
			t.Errorf("isValidWebhookURL(%q) = %v, want %v", tt.url, got, tt.want)
		}
	}
}
