package dev.ritmo.shared;
public final class BusinessFailure extends RuntimeException {
    public final String code;
    public BusinessFailure(String code) { super(code); this.code=code; }
}
