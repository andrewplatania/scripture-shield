package main

import (
	"embed"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2"
)

//go:embed web
var webFS embed.FS

var (
	user32              = syscall.NewLazyDLL("user32.dll")
	pMessageBox         = user32.NewProc("MessageBoxW")
	pGetWindowLongPtr   = user32.NewProc("GetWindowLongPtrW")
	pSetWindowLongPtr   = user32.NewProc("SetWindowLongPtrW")
	pGetWindowPlacement = user32.NewProc("GetWindowPlacement")
	pSetWindowPlacement = user32.NewProc("SetWindowPlacement")
	pMonitorFromWindow  = user32.NewProc("MonitorFromWindow")
	pGetMonitorInfo     = user32.NewProc("GetMonitorInfoW")
	pSetWindowPos       = user32.NewProc("SetWindowPos")
	pShowWindow         = user32.NewProc("ShowWindow")
	pDwmSetAttr         = syscall.NewLazyDLL("dwmapi.dll").NewProc("DwmSetWindowAttribute")
)

type rect struct{ L, T, R, B int32 }

type windowPlacement struct {
	Length, Flags, ShowCmd uint32
	MinPos, MaxPos         [2]int32
	Normal                 rect
}

type monitorInfo struct {
	Size          uint32
	Monitor, Work rect
	Flags         uint32
}

const (
	swMaximize        = 3
	wsOverlappedWindw = 0x00CF0000
	swpNoSize         = 0x0001
	swpNoMove         = 0x0002
	swpNoZOrder       = 0x0004
	swpNoOwnerZOrder  = 0x0200
	swpFrameChanged   = 0x0020
)

func listen() net.Listener {
	if l, err := net.Listen("tcp", "127.0.0.1:47813"); err == nil {
		return l
	}
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fatal("Could not start the local viewer: " + err.Error())
	}
	return l
}

func fatal(msg string) {
	title, _ := syscall.UTF16PtrFromString("Scripture Shield")
	text, _ := syscall.UTF16PtrFromString(msg)
	pMessageBox.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x10)
	os.Exit(1)
}

func darkTitleBar(hwnd uintptr) {
	on := int32(1)
	pDwmSetAttr.Call(hwnd, 20, uintptr(unsafe.Pointer(&on)), 4)
	bg := int32(0x0014100E)
	pDwmSetAttr.Call(hwnd, 35, uintptr(unsafe.Pointer(&bg)), 4)
}

type fullscreen struct {
	on    bool
	style uintptr
	wp    windowPlacement
}

func (f *fullscreen) set(hwnd uintptr, on bool) {
	if on == f.on {
		return
	}
	gwlStyle := -16
	if on {
		f.style, _, _ = pGetWindowLongPtr.Call(hwnd, uintptr(gwlStyle))
		f.wp.Length = uint32(unsafe.Sizeof(f.wp))
		pGetWindowPlacement.Call(hwnd, uintptr(unsafe.Pointer(&f.wp)))
		mon, _, _ := pMonitorFromWindow.Call(hwnd, 2)
		mi := monitorInfo{}
		mi.Size = uint32(unsafe.Sizeof(mi))
		if ok, _, _ := pGetMonitorInfo.Call(mon, uintptr(unsafe.Pointer(&mi))); ok == 0 {
			return
		}
		pSetWindowLongPtr.Call(hwnd, uintptr(gwlStyle), f.style&^wsOverlappedWindw)
		pSetWindowPos.Call(hwnd, 0,
			uintptr(mi.Monitor.L), uintptr(mi.Monitor.T),
			uintptr(mi.Monitor.R-mi.Monitor.L), uintptr(mi.Monitor.B-mi.Monitor.T),
			swpNoOwnerZOrder|swpFrameChanged)
	} else {
		pSetWindowLongPtr.Call(hwnd, uintptr(gwlStyle), f.style)
		pSetWindowPlacement.Call(hwnd, uintptr(unsafe.Pointer(&f.wp)))
		pSetWindowPos.Call(hwnd, 0, 0, 0, 0, 0,
			swpNoMove|swpNoSize|swpNoZOrder|swpNoOwnerZOrder|swpFrameChanged)
	}
	f.on = on
}

func main() {
	sub, err := fs.Sub(webFS, "web")
	if err != nil {
		fatal(err.Error())
	}
	l := listen()
	files := http.FileServer(http.FS(sub))
	go http.Serve(l, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		files.ServeHTTP(w, r)
	}))

	dataDir := filepath.Join(os.Getenv("LOCALAPPDATA"), "ScriptureShield")
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		AutoFocus: true,
		DataPath:  dataDir,
		WindowOptions: webview2.WindowOptions{
			Title:  "Scripture Shield",
			Width:  1000,
			Height: 720,
			IconId: 1,
			Center: true,
		},
	})
	if w == nil {
		fatal("Scripture Shield needs the Microsoft Edge WebView2 Runtime, which is built into Windows 11 and most Windows 10 PCs.\n\nInstall it free from:\nhttps://developer.microsoft.com/microsoft-edge/webview2/")
	}
	defer w.Destroy()

	hwnd := uintptr(w.Window())
	darkTitleBar(hwnd)
	w.SetSize(420, 480, webview2.HintMin)

	full := &fullscreen{}
	w.Bind("setFullscreen", func(on bool) bool {
		w.Dispatch(func() { full.set(hwnd, on) })
		return on
	})

	pShowWindow.Call(hwnd, swMaximize)
	w.Navigate("http://" + l.Addr().String() + "/index.html")
	w.Run()
}
