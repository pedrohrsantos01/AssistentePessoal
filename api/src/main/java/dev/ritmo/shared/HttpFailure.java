package dev.ritmo.shared;
public final class HttpFailure extends RuntimeException {
    public final int status; public final String code;
    public HttpFailure(int status,String code) {super(code);this.status=status;this.code=code;}
}
