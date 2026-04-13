package transcoder

import (
	"bufio"
	"io"
	"math"
	"regexp"
	"strconv"
	"strings"
)

var timeRegex = regexp.MustCompile(`time=(\d+):(\d+):(\d+)\.(\d+)`)

// scanCRLF is a bufio.SplitFunc that splits on \r or \n (or \r\n)
func scanCRLF(data []byte, atEOF bool) (advance int, token []byte, err error) {
	if atEOF && len(data) == 0 {
		return 0, nil, nil
	}
	for i := 0; i < len(data); i++ {
		if data[i] == '\n' {
			// Trim a preceding \r if present
			end := i
			if end > 0 && data[end-1] == '\r' {
				end--
			}
			return i + 1, data[:end], nil
		}
		if data[i] == '\r' {
			// Standalone \r (not followed by \n)
			if i+1 < len(data) {
				if data[i+1] == '\n' {
					return i + 2, data[:i], nil
				}
				return i + 1, data[:i], nil
			}
			// \r at end of buffer — need more data to know if \n follows
			if atEOF {
				return len(data), data[:i], nil
			}
			return 0, nil, nil // request more data
		}
	}
	if atEOF {
		return len(data), data, nil
	}
	return 0, nil, nil // request more data
}

// ParseProgress reads FFmpeg stderr output, calls progressCb with a 0-100
// percentage, and returns the last N non-progress lines (errors/warnings)
func ParseProgress(stderr io.Reader, totalDuration float64, progressCb func(float64)) []string {
	const tailSize = 30
	tail := make([]string, 0, tailSize)

	scanner := bufio.NewScanner(stderr)
	scanner.Split(scanCRLF)

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		if strings.Contains(line, "time=") {
			matches := timeRegex.FindStringSubmatch(line)
			if len(matches) >= 5 {
				h, _ := strconv.ParseFloat(matches[1], 64)
				m, _ := strconv.ParseFloat(matches[2], 64)
				s, _ := strconv.ParseFloat(matches[3], 64)
				frac, _ := strconv.ParseFloat(matches[4], 64)
				frac = frac / math.Pow(10, float64(len(matches[4])))
				currentSec := h*3600 + m*60 + s + frac
				progress := (currentSec / totalDuration) * 100
				if progress > 100 {
					progress = 100
				}
				progressCb(progress)
			}
			continue
		}

		// Accumulate non-progress lines (errors, warnings, codec info)
		if len(tail) >= tailSize {
			tail = tail[1:]
		}
		tail = append(tail, trimmed)
	}
	return tail
}

// DrainStderr reads stderr fully and returns the last N lines.
// Used when duration is unknown and progress parsing is not possible.
func DrainStderr(stderr io.Reader) []string {
	const tailSize = 30
	tail := make([]string, 0, tailSize)

	scanner := bufio.NewScanner(stderr)
	scanner.Split(scanCRLF)
	for scanner.Scan() {
		trimmed := strings.TrimSpace(scanner.Text())
		if trimmed == "" {
			continue
		}
		if len(tail) >= tailSize {
			tail = tail[1:]
		}
		tail = append(tail, trimmed)
	}
	return tail
}
