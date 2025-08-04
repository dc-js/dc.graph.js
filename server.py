#!/usr/bin/env python3
"""
Simple HTTP server with WASM MIME type support
"""
import http.server
import socketserver
import mimetypes
import sys
import os

# Add WASM MIME type
mimetypes.add_type('application/wasm', '.wasm')

class WASMHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        super().end_headers()

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
    
    # Change to web directory to serve it as root
    if os.path.exists('web'):
        os.chdir('web')
        print("Serving web/ directory as root")
    else:
        print("Warning: web/ directory not found, serving current directory")
    
    with socketserver.TCPServer(("", port), WASMHTTPRequestHandler) as httpd:
        print(f"Serving at http://localhost:{port}")
        print("WASM MIME type support enabled")
        httpd.serve_forever()

if __name__ == '__main__':
    main()