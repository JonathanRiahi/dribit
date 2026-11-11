"""Serves the folder it is started in at http://localhost:<port>, for the simulator checks in the build workflow.

Python's own `-m http.server` looks up the machine's network name before it starts answering, which on a build
machine can take most of a minute; until then a phone that asks just waits. This one skips the lookup.
"""
import http.server
import socket
import socketserver
import sys


class Server(http.server.ThreadingHTTPServer):
    def server_bind(self):
        if self.address_family == socket.AF_INET6:
            # answer on both of localhost's addresses (::1 and 127.0.0.1)
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        socketserver.TCPServer.server_bind(self)
        self.server_name = "localhost"
        self.server_port = self.server_address[1]


class ServerV6(Server):
    address_family = socket.AF_INET6


def start(port):
    try:
        return ServerV6(("::", port), http.server.SimpleHTTPRequestHandler)
    except OSError:
        # a machine with no IPv6 at all
        return Server(("0.0.0.0", port), http.server.SimpleHTTPRequestHandler)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    with start(port) as httpd:
        print("serving on port %d" % port, flush=True)
        httpd.serve_forever()
