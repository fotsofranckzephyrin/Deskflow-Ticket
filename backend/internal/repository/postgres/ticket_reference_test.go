package postgres

import "testing"

func TestFormatTicketNumber(t *testing.T) {
	tests := []struct {
		sequence int64
		want     string
	}{
		{sequence: 1, want: "TCK-00001"},
		{sequence: 35, want: "TCK-0000Z"},
		{sequence: 36, want: "TCK-00010"},
		{sequence: 36 * 36 * 36 * 36, want: "TCK-10000"},
		{sequence: maxShortTicketReference, want: "TCK-ZZZZZ"},
	}

	for _, test := range tests {
		got, err := formatTicketNumber(test.sequence)
		if err != nil {
			t.Fatalf("formatTicketNumber(%d) returned error: %v", test.sequence, err)
		}
		if got != test.want {
			t.Errorf("formatTicketNumber(%d) = %q, want %q", test.sequence, got, test.want)
		}
	}
}

func TestFormatTicketNumberRejectsOutOfRangeSequences(t *testing.T) {
	for _, sequence := range []int64{0, maxShortTicketReference + 1} {
		if _, err := formatTicketNumber(sequence); err == nil {
			t.Errorf("formatTicketNumber(%d) expected an error", sequence)
		}
	}
}
