package interfaces

type PasswordService interface {
	Hash(password string) (string, error)
	Compare(hashedPassword string, plainPassword string) error
}
