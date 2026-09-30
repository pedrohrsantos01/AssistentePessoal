package dev.ritmo.shared;
public final class HttpFailure extends RuntimeException {
    public final int status; public final String code; public final long retryAfterSeconds;
    public HttpFailure(int status,String code) {this(status,code,0);}
    public HttpFailure(int status,String code,long retryAfterSeconds) {super(code);this.status=status;this.code=code;this.retryAfterSeconds=retryAfterSeconds;}
}
