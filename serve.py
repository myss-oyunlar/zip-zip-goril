# Oyunu yerelde açmak için: python serve.py  ->  http://localhost:8123
# Önbelleği kapatır, böylece dosya değişince sayfayı yenilemek yeterli olur.
# Aynı Wi-Fi'deki telefondan denemek için: python serve.py --lan
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    host = "0.0.0.0" if "--lan" in sys.argv else "127.0.0.1"
    print(f"Oyun: http://localhost:8123  (dinlenen adres {host})")
    http.server.ThreadingHTTPServer((host, 8123), NoCacheHandler).serve_forever()
