import styled from 'styled-components'
import React from 'react'

import { WordMarkLogo } from '../interface/Logo'

export const CheckoutFooter = () => (
  <FooterWrapper>
    <span>Powered by</span>
    <a
      href="https://unlock-protocol.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      <WordMark alt="Unlock" />
    </a>
  </FooterWrapper>
)

const FooterWrapper = styled.footer`
  margin-top: 50px;
  font-size: 12px;
  text-align: center;

  div {
    margin: 8px;
    vertical-align: middle;
    display: inline-block;
    width: 20px;
    height: 20px;
  }
`

const WordMark = styled(WordMarkLogo)`
  width: 48px;
  margin-bottom: -1px;
  margin-left: 4px;
`
