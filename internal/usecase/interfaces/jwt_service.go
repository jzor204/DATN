package interfaces

type AuthClaims struct {
	UserID     uint
	Email      string
	GlobalRole string
}

type JWTService interface {
	GenerateAccessToken(claims AuthClaims) (string, error)
	ParseAccessToken(token string) (*AuthClaims, error)
}
