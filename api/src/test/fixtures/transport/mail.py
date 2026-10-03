"""SMTP protocol fixture with real TLS and authentication, on loopback only."""
import base64
from email import policy
from email.parser import BytesParser
import socketserver
import ssl
import threading

class Handler(socketserver.StreamRequestHandler):
    def finish(self):
        try: super().finish()
        finally: self.connection.close()

    def handle(self):
        self.connection.settimeout(4);secure=False;authenticated=False
        def reply(value):
            self.wfile.write(value.encode()+b"\r\n");self.wfile.flush()
        try:
            reply("220 fixture")
            while True:
                line=self.rfile.readline(8192)
                if not line: return
                command=line.decode().strip();verb=command.split(" ",1)[0].upper()
                if verb in ("EHLO","HELO"):
                    reply("250-fixture")
                    if not secure and self.server.tls_enabled: reply("250-STARTTLS")
                    if secure: reply("250-AUTH PLAIN")
                    reply("250 OK")
                elif verb=="STARTTLS" and self.server.tls_enabled:
                    reply("220 Ready")
                    wrapped=self.server.context.wrap_socket(self.connection,server_side=True)
                    self.rfile.close();self.wfile.close();self.connection=wrapped
                    self.rfile=wrapped.makefile("rb");self.wfile=wrapped.makefile("wb");secure=True
                elif verb=="AUTH" and secure:
                    payload=command.split()[-1]
                    authenticated=(base64.b64decode(payload)==b"\0fixture\0fixture-token")
                    reply("235 Authenticated" if authenticated else "535 Refused")
                elif verb=="NOOP":
                    reply("250 OK" if secure and authenticated and self.server.healthy else "451 Unavailable")
                elif verb=="MAIL":
                    reply("250 OK" if secure and authenticated else "530 TLS/auth required")
                elif verb=="RCPT":
                    reply("550 Refused" if self.server.refuse else "250 OK")
                elif verb=="DATA":
                    reply("354 Input")
                    chunks=[]
                    while True:
                        line=self.rfile.readline(8192)
                        if line in (b".\r\n",b""): break
                        chunks.append(line[1:] if line.startswith(b"..") else line)
                    self.server.messages.append(BytesParser(policy=policy.default).parsebytes(b"".join(chunks)))
                    reply("250 Accepted")
                elif verb in ("RSET",): reply("250 OK")
                elif verb=="QUIT": reply("221 Bye");return
                else: reply("502 Unsupported")
        except (OSError,ValueError): pass

class Mail(socketserver.ThreadingTCPServer):
    allow_reuse_address=True
    daemon_threads=True
    def __init__(self, certificate, key):
        self.context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);self.context.load_cert_chain(certificate,key)
        self.messages=[];self.refuse=False;self.healthy=True;self.tls_enabled=True
        super().__init__(("127.0.0.1",0),Handler)
        self.thread=threading.Thread(target=self.serve_forever,daemon=True);self.thread.start()
    def close(self):
        self.shutdown();self.server_close();self.thread.join(5)
