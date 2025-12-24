package auth

import (
	"context"
	"encoding/json"

	"golang.org/x/oauth2"
)

type OIDCProvider struct {
	Config      *oauth2.Config
	UserInfoURL string
}

func NewOIDCProvider(clientID, clientSecret, redirectURL, authURL, tokenURL, userInfoURL string) *OIDCProvider {
	return &OIDCProvider{
		Config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Endpoint: oauth2.Endpoint{
				AuthURL:  authURL,
				TokenURL: tokenURL,
			},
			Scopes: []string{"openid", "profile", "email", "groups"},
		},
		UserInfoURL: userInfoURL,
	}
}

func (p *OIDCProvider) GetAuthURL(state string) string {
	return p.Config.AuthCodeURL(state)
}

func (p *OIDCProvider) Exchange(code string) (*oauth2.Token, error) {
	return p.Config.Exchange(context.Background(), code)
}

type UserInfo struct {
	Sub     string   `json:"sub"`
	Name    string   `json:"name"`
	Email   string   `json:"email"`
	Picture string   `json:"picture"`
	Groups  []string `json:"groups"`
}

func (p *OIDCProvider) GetUserInfo(token *oauth2.Token) (*UserInfo, error) {
	client := p.Config.Client(context.Background(), token)
	resp, err := client.Get(p.UserInfoURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var info UserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	return &info, nil
}
