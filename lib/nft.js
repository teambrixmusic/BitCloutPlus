/*
 Copyright (C) Paul Burke 2021
 Github: @ipaulpro/bitcloutplus
 Distributed under the MIT License (license terms are at http://opensource.org/licenses/MIT).
 */

const serialNumberSelectorId = 'plus_nft-serial-number-selector'

const CLOUT_PUBLIC_KEY_PREFIX = 'BC1YL'

let isRequestingNftEntries = false

const isBurnNftUrl = () => {
  const segments = new URL(document.location).pathname.split('/')
  return segments[1] === 'nft' && segments[segments.length - 1] === 'burn'

}

const isNftTransfersUrl = () => {
  const segments = new URL(document.location).pathname.split('/')
  return segments[1] === 'nft-transfers'

}

const isTransferNftUrl = () => {
  const segments = new URL(document.location).pathname.split('/')
  return segments[1] === 'nft' && segments[segments.length - 1] === 'transfer'
}

const enrichNftPostPage = (nftPostPage) => {
  if (!nftPostPage || isRequestingNftEntries) return

  const burnNftButtonId = 'plus-btn-burn-nft'
  if (document.getElementById(burnNftButtonId)) return

  const publicKey = getLoggedInPublicKey()
  const postHashHex = getPostHashHexFromUrl()
  if (!publicKey || !postHashHex) return

  const nftPost = nftPostPage.querySelector('nft-post')

  const feedPostElement = nftPost.querySelector('feed-post')
  if (!feedPostElement) return

  const footerElement = feedPostElement.firstElementChild.lastElementChild
  if (!footerElement) return

  isRequestingNftEntries = true

  getNftEntriesForPostHashHex(publicKey, postHashHex)
    .then(nftEntries => {
      const ownedEntries = nftEntries.filter(entry => entry['OwnerPublicKeyBase58Check'] === publicKey)
      if (ownedEntries.length === 0 || !isRequestingNftEntries) return

      const container = footerElement.firstElementChild
      container.firstElementChild.classList.add('flex-grow-1')

      const transferButton = createTransferButton(postHashHex)
      container.appendChild(transferButton)

      const url = window.location.href.split('?')[0]
      const burnButton = createBurnButtonElement('Burn NFT')
      burnButton.id = burnNftButtonId
      burnButton.onclick = () => window.location.href = `${url}/burn`

      const ownedEntriesForSale = ownedEntries.filter(entry => entry['IsForSale'] === true)
      if (ownedEntriesForSale.length === ownedEntries.length) {
        burnButton.disabled = true
        burnButton.title = 'You cannot burn an NFT that is for sale'
        transferButton.disabled = true
        transferButton.title = 'You cannot transfer an NFT that is for sale'
      }

      container.appendChild(burnButton)
    })
    .finally(() => {
      isRequestingNftEntries = false
    })
}

const signTransaction = (res) => {
  const transactionHex = res['TransactionHex']
  if (!transactionHex) {
    return Promise.reject('Error creating burn-nft transaction')
  }

  const identity = getCurrentIdentity()
  if (!identity) {
    return Promise.reject('No Identity found')
  }

  const id = _.UUID.v4()
  sendSignTransactionMsg(identity, transactionHex, id)
}

const onBurnNftClick = (publicKey, postHashHex, serialNumber) =>
  burnNft(publicKey, postHashHex, serialNumber)
    .then(signTransaction)
    .catch(console.error)

const createSerialNumberSelector = (publicKey, nftEntries) => {
  const ownedEntries = nftEntries.filter(entry => entry['OwnerPublicKeyBase58Check'] === publicKey)
  if (ownedEntries.length === 0) {
    throw new Error()
  }

  const serialNumberSelector = document.createElement('select')
  serialNumberSelector.id = serialNumberSelectorId
  serialNumberSelector.className = 'form-control w-auto'

  const options = []
  ownedEntries.forEach(entry => {
    const option = document.createElement('option')
    option.value = entry['SerialNumber']
    option.innerText = `Serial #${entry['SerialNumber']}`
    options.push(option)
  })
  options.forEach(option => serialNumberSelector.appendChild(option))

  const container = document.createElement('div')
  container.className = 'flex-grow-1'
  container.appendChild(serialNumberSelector)

  return container
}

const createNftPostElement = (postEntry, notFoundElement, username, buttonElements, serialNumberElement, singleEntryDisplayed = false) => {
  const postDiv = document.createElement('div')
  postDiv.id = `plus-nft-post-${postEntry['PostHashHex']}`
  postDiv.className = 'feed-post__container js-feed-post-hover border d-flex justify-content-left w-100 px-15px pb-15px pt-15px feed-post__parent-post-font-size cursor-pointer'
  postDiv.onclick = () => window.location.href = `/nft/${postEntry['PostHashHex']}`
  if (singleEntryDisplayed) postDiv.classList.add('feed-post__blue-border')

  const avatarAnchor = document.createElement('a')
  avatarAnchor.className = 'feed-post__avatar br-12px'
  avatarAnchor.style.backgroundImage = `url("${getProfilePhotoUrlForPublicKey(postEntry['PosterPublicKeyBase58Check'])}")`

  const avatarContainer = document.createElement('div')
  avatarContainer.className = 'feed-post__avatar-container'
  avatarContainer.appendChild(avatarAnchor)
  postDiv.appendChild(avatarContainer)

  const contentInnerDiv = document.createElement('div')
  contentInnerDiv.className = 'roboto-regular mt-1'
  contentInnerDiv.style.overflowWrap = 'anywhere'
  contentInnerDiv.style.wordBreak = 'break-word'
  contentInnerDiv.style.outline = 'none'
  contentInnerDiv.innerText = postEntry['Body']

  const imageUrls = postEntry['ImageURLs']
  if (imageUrls && imageUrls.length > 0) {
    const contentImage = document.createElement('img')
    contentImage.className = 'feed-post__image'
    contentImage.src = imageUrls[0]

    const contentImageDiv = document.createElement('div')
    contentImageDiv.className = 'feed-post__image-container'
    contentImageDiv.appendChild(contentImage)
    contentInnerDiv.appendChild(contentImageDiv)
  }

  const usernameDiv = document.createElement('div')
  usernameDiv.className = 'fc-default font-weight-bold'
  usernameDiv.innerText = username

  const contentOuterDiv = document.createElement('div')
  contentOuterDiv.className = 'w-100'
  contentOuterDiv.appendChild(usernameDiv)
  contentOuterDiv.appendChild(contentInnerDiv)
  postDiv.appendChild(contentOuterDiv)

  const postFooterContentDiv = document.createElement('div')
  postFooterContentDiv.className = 'd-flex justify-content-between align-items-center'
  postFooterContentDiv.appendChild(serialNumberElement)

  if (buttonElements) {
    buttonElements.forEach(button => {
      postFooterContentDiv.appendChild(button)
    })
  }

  const postFooterDiv = document.createElement('div')
  postFooterDiv.className = 'p-15px fs-15px w-100 background-color-grey'
  if (singleEntryDisplayed) postFooterDiv.classList.add('feed-post__blue-border')
  postFooterDiv.appendChild(postFooterContentDiv)
  notFoundElement.appendChild(postDiv)
  notFoundElement.appendChild(postFooterDiv)

  const padding = document.createElement('div')
  padding.className = 'w-100'
  padding.classList.add(singleEntryDisplayed ? 'p-35px' : 'p-1')

  const postContainerDiv = document.createElement('div')
  postContainerDiv.className = 'feed-post__container w-100'
  if (!singleEntryDisplayed) {
    postContainerDiv.classList.add('px-15px')
    postContainerDiv.classList.add('pb-15px')
    postContainerDiv.classList.add('pt-15px')
  }
  postContainerDiv.appendChild(postDiv)
  postContainerDiv.appendChild(postFooterDiv)
  postContainerDiv.appendChild(padding)

  notFoundElement.appendChild(postContainerDiv)
}

const setCustomPageTopBarTitle = (title) => {
  const topBar = document.querySelector(`top-bar-mobile-navigation-control`)
  if (!topBar) return

  const titleElement = topBar.parentElement
  titleElement.innerText = title
}

const getCustomPageNotFoundElement = () => {
  const notFoundElement = document.querySelector(`not-found`)
  const notFoundContentContainer = document.querySelector(`.not-found__content-container`)
  notFoundElement.removeChild(notFoundContentContainer)
  return notFoundElement
}

function showSpinner(button) {
  const spinnerAlt = document.createElement('span')
  spinnerAlt.className = 'sr-only'
  spinnerAlt.innerText = 'Working...'

  const spinner = document.createElement('div')
  spinner.className = 'spinner-border spinner-border-sm text-light'
  spinner.dataset.role = 'status'
  spinner.appendChild(spinnerAlt)

  button.disabled = true
  button.innerText = ''
  button.appendChild(spinner)
}

const getSerialNumber = () => {
  const serialNumberSelector = document.getElementById(serialNumberSelectorId)
  if (!serialNumberSelector) return

  return Number(serialNumberSelector.value)
}

function createBurnButtonElement(text) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'btn btn-danger font-weight-bold br-8px fs-13px'
  button.innerText = text
  return button
}

const createBurnButton = (publicKey, postHashHex, text) => {
  const button = createBurnButtonElement(text)
  button.onclick = () => {
    showSpinner(button)
    const serialNumber = getSerialNumber()
    onBurnNftClick(publicKey, postHashHex, serialNumber)
      .catch(err => {
        console.error(err)
        button.innerText = 'Burn NFT'
        button.classList.remove('disabled')
      })
  }
  return button
}

const createTransferButton = (postHashHex) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'btn btn-primary font-weight-bold br-8px fs-13px mx-3'
  button.innerText = 'Transfer NFT'
  button.onclick = () => window.location.href = `/nft/${postHashHex}/transfer`
  return button
}

function createCustomPageHeaderElement(text) {
  const headerElement = document.createElement('div')
  headerElement.className = 'd-flex align-items-center fs-15px fc-muted p-15px background-color-light-grey'
  headerElement.innerText = text
  return headerElement
}

function addPostToBody(publicKey, postHashHex, confirmTextElement, notFoundElement, buttons, singleEntryDisplayed) {
  getBidsForNftPost(publicKey, postHashHex)
    .then(res => {
      const post = res['PostEntryResponse']
      const nftEntries = res['NFTEntryResponses']

      getProfileByPublicKey(post['PosterPublicKeyBase58Check'])
        .then(profile => {
          const username = profile['Username']
          try {
            const serialNumberSelector = createSerialNumberSelector(publicKey, nftEntries)
            createNftPostElement(post, notFoundElement, username, buttons, serialNumberSelector, singleEntryDisplayed)
          } catch (e) {
            confirmTextElement.innerText = 'You don\'t own this NFT'
          }
        })
    })
}

const createBurnNftPage = () => {
  setCustomPageTopBarTitle('Burn NFT')

  const notFoundElement = getCustomPageNotFoundElement()
  const headerElement = createCustomPageHeaderElement(
    'Burning an NFT is an irreversible action that revokes your ownership and "un-mints" the serial number.'
  )
  notFoundElement.appendChild(headerElement)

  const confirmTextElement = document.createElement('div')
  confirmTextElement.className = 'fs-15px font-weight-bold mt-15px px-15px text-danger pb-3 border-bottom border-color-grey'
  confirmTextElement.innerText = 'Are you sure you want to burn this NFT?'
  notFoundElement.appendChild(confirmTextElement)

  const postHashHex = getPostHashHexFromUrl()
  const publicKey = getLoggedInPublicKey()
  if (!publicKey || !postHashHex) return

  const button = createBurnButton(publicKey, postHashHex, 'Burn NFT')

  addPostToBody(publicKey, postHashHex, confirmTextElement, notFoundElement, [button])
}

const search = (text, cb) => {
  if (text.startsWith(CLOUT_PUBLIC_KEY_PREFIX)) {
    return getProfileByPublicKey(text).then(profile => {
      const profiles = [profile]
      return cb(profiles)
    })
  } else {
    return searchUsernames(text, profiles => {
      return cb(profiles)
    })
  }
}

const getLookupKey = (item, text) => {
  if (text.startsWith(CLOUT_PUBLIC_KEY_PREFIX)) {
    return item['PublicKeyBase58Check']
  } else {
    return item['Username']
  }
}

const addAutocomplete = (input, containerElement) => {
  const tribute = new Tribute({
    autocompleteMode: true,
    replaceTextSuffix: '',
    values: (text, cb) => search(text, cb),
    menuItemTemplate: (item) => buildTributeUsernameMenuTemplate(item),
    loadingItemTemplate: buildLoadingItemTemplate(),
    fillAttr: 'Username',
    lookup: (item, text) => getLookupKey(item, text)
  })
  tribute.attach(input)
}

const createNftTransfersSearchArea = () => {
  const searchBarIcon = document.createElement('i')
  searchBarIcon.className = 'icon-search'

  const searchBarIconSpan = document.createElement('span')
  searchBarIconSpan.className = 'input-group-text search-bar__icon'
  searchBarIconSpan.style.borderTopLeftRadius = '0.25rem'
  searchBarIconSpan.style.borderBottomLeftRadius = '0.25rem'
  searchBarIconSpan.appendChild(searchBarIcon)

  const input = document.createElement('input')
  input.id = 'plus-nft-recipient-input'
  input.type = 'text'
  input.placeholder = 'Search'
  input.className = 'form-control shadow-none search-bar__fix-active'
  input.style.fontSize = '15px'
  input.style.paddingLeft = '0'
  input.style.borderLeftColor = 'rgba(0, 0, 0, 0)'

  const inputGroupPrepend = document.createElement('div')
  inputGroupPrepend.className = 'input-group-prepend w-100'
  inputGroupPrepend.appendChild(searchBarIconSpan)
  inputGroupPrepend.appendChild(input)

  const inputGroup = document.createElement('div')
  inputGroup.className = 'input-group'
  inputGroup.appendChild(inputGroupPrepend)

  const innerDiv = document.createElement('div')
  innerDiv.className = 'd-flex align-items-center w-100 text-grey8A fs-15px global__top-bar__height'
  innerDiv.appendChild(inputGroup)

  const searchBar = document.createElement('div')
  searchBar.className = 'w-100 global__top-bar__height'
  searchBar.appendChild(innerDiv)

  const userSelectDiv = document.createElement('div')
  userSelectDiv.className = 'fs-15px font-weight-bold mt-4 px-15px'
  userSelectDiv.innerText = 'Recipient public key or username'
  userSelectDiv.appendChild(searchBar)

  addAutocomplete(input, userSelectDiv)

  return userSelectDiv
}

const createTransferNftPage = () => {
  setCustomPageTopBarTitle('Transfer an NFT')

  const notFoundElement = getCustomPageNotFoundElement()

  const headerElement = createCustomPageHeaderElement(
    'When you transfer an NFT, the recipient may only be notified if they have BitClout+ installed.\n\n' +
    'The recipient may accept the transfer, return it, or burn the NFT to reject it. You cannot undo this.'
  )
  notFoundElement.appendChild(headerElement)

  const userSelectDiv = createNftTransfersSearchArea()
  notFoundElement.appendChild(userSelectDiv)

  const postHashHex = getPostHashHexFromUrl()
  const publicKey = getLoggedInPublicKey()
  if (!publicKey || !postHashHex) return

  const transferButton = document.createElement('button')
  transferButton.id = 'plus-nft-transfer-button'
  transferButton.type = 'button'
  transferButton.className = 'btn btn-primary font-weight-bold br-8px fs-13px ml-3'
  transferButton.innerText = 'Transfer'
  transferButton.onclick = () => {
    showSpinner(transferButton)
    const serialNumber = getSerialNumber()

    const text = document.getElementById('plus-nft-recipient-input').value
    if (!text || text.length === 0) {
      transferButton.disabled = false
      transferButton.innerText = 'Transfer'
      return
    }

    const getProfile = text.startsWith(CLOUT_PUBLIC_KEY_PREFIX) ? getProfileByPublicKey(text) : getProfileByUsername(text)
    getProfile.then(profile => {
      const receiverPublicKey = profile['PublicKeyBase58Check']
      if (!receiverPublicKey) return Promise.reject(`Unable to retrieve profile for ${text}`)

      return transferNft(publicKey, receiverPublicKey, postHashHex, serialNumber)
    })
      .then(signTransaction)
      .catch(err => {
        console.error(err)
        transferButton.disabled = false
        transferButton.innerText = 'Transfer'
      })
  }

  addPostToBody(publicKey, postHashHex, headerElement, notFoundElement, [transferButton], true)
}

const createAcceptButton = (publicKey, postEntry, serialNumber, declineButton) => {
  const acceptButton = document.createElement('button')
  acceptButton.type = 'button'
  acceptButton.className = 'btn btn-primary font-weight-bold br-8px fs-13px ml-3'
  acceptButton.innerText = 'Accept'
  acceptButton.onclick = () => {
    showSpinner(acceptButton)
    declineButton.disabled = true
    acceptTransferNft(publicKey, postEntry['PostHashHex'], serialNumber)
      .then(signTransaction)
      .catch(err => {
        console.error(err)
        acceptButton.disabled = false
        acceptButton.innerText = 'Accept'
        declineButton.disabled = false
      })
  }
  return acceptButton
}

function createNftTransfersElement() {
  const emptySpan = document.createElement('span')
  emptySpan.innerText = 'No pending NFT transfers'

  const emptyInnerDiv = document.createElement('div')
  emptyInnerDiv.className = 'background-color-grey p-35px br-12px d-flex flex-row align-items-center'
  emptyInnerDiv.style.textAlign = 'center'
  emptyInnerDiv.appendChild(emptySpan)

  const emptyOuterDiv = document.createElement('div')
  emptyOuterDiv.className = 'p-15px'
  emptyOuterDiv.appendChild(emptyInnerDiv)

  return emptyOuterDiv
}

const getPendingNftTransfers = (publicKey) => getNftsForUser(publicKey).then(res =>
  Object.values(res).filter(value => value['NFTEntryResponses']
    .filter(nft => nft['IsPending'] === true).length > 0)
)

const createNftTransfersPage = () => {
  setCustomPageTopBarTitle('NFT Transfers')

  const notFoundElement = getCustomPageNotFoundElement()

  const headerElement = createCustomPageHeaderElement(
    'When an NFT is transferred it remains in a "pending" state until accepted by the recipient.'
  )
  notFoundElement.appendChild(headerElement)

  const publicKey = getLoggedInPublicKey()
  getPendingNftTransfers(publicKey).then(pendingNfts => {
    if (pendingNfts.length === 0) {
      const emptyElement = createNftTransfersElement(notFoundElement)
      notFoundElement.appendChild(emptyElement)
      return
    }

    pendingNfts.forEach(value => {
      const postEntry = value['PostEntryResponse']
      const nftEntries = value['NFTEntryResponses']

      nftEntries.forEach(nft => {
        const serialNumber = nft['SerialNumber']

        const serialNumberElement = document.createElement('div')
        serialNumberElement.className = 'form-control w-auto'
        serialNumberElement.innerText = `Serial ${serialNumber}`

        const serialNumberSpacer = document.createElement('div')
        serialNumberSpacer.className = 'flex-grow-1'
        serialNumberSpacer.appendChild(serialNumberElement)

        const declineButton = createBurnButtonElement('Decline')
        declineButton.onclick = () => window.location.href = `/nft/${postEntry['PostHashHex']}/burn`
        const acceptButton = createAcceptButton(publicKey, postEntry, serialNumber, declineButton)
        const buttonElements = [serialNumberSpacer, declineButton, acceptButton]

        const username = postEntry['ProfileEntryResponse']['Username']

        createNftPostElement(postEntry, notFoundElement, username, buttonElements, serialNumberElement)
      })
    })
  })
}

const addNftTransfersMenuItem = () => {
  const id = 'plus-nft-transfers-left-bar-button'
  if (document.getElementById(id)) return

  const leftBarButtons = document.querySelectorAll('left-bar-button')
  if (!leftBarButtons || leftBarButtons.length === 0) return

  const sidebar = leftBarButtons[0].parentElement

  const dividers = sidebar.querySelectorAll('.p-15px')
  if (!dividers) return

  const a = document.createElement('a')
  a.className = 'cursor-pointer fs-15px text-grey5'
  a.href = '/nft-transfers'
  a.innerText = 'NFT Transfers'

  const innerDiv = document.createElement('div')
  innerDiv.className = 'd-flex justify-content-center align-items-center'
  innerDiv.appendChild(a)

  const dot = document.createElement('a')
  const active = new URL(window.location).pathname.includes('nft-transfers')
  dot.className = active ? 'left-bar__dot-active' : 'left-bar__dot-inactive'
  dot.href = '/nft-transfers'
  dot.innerText = ' · '

  const outerDiv = document.createElement('div')
  outerDiv.className = 'w-100 d-flex pt-15px pl-15px'
  outerDiv.appendChild(dot)
  outerDiv.appendChild(innerDiv)

  const leftBarButton = document.createElement('left-bar-button')
  leftBarButton.id = id
  leftBarButton.appendChild(outerDiv)

  sidebar.insertBefore(leftBarButton, dividers[1])

  checkForNftTransfers()
}