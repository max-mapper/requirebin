var $ = window.$

var editors = require('./editors')

var $spinner = $('.spinner')
var $runButton = $('.play-button')
var $editors = $('.require-bin-editor')
var $editorPickerLinks = $('.editor-picker a')

var shareForm = document.querySelector('#share-options')
var shareIFrame = document.querySelector('#share-iframe-example')

function embedURL (gistID) {
  return window.location.origin + '/embed2?gist=' + gistID
}

var controls = {
  $spinner: $spinner,
  $runButton: $runButton,

  /**
   * listeners that exist while the app exists
   */
  init: function (gistID) {
    var self = this

    // share
    document.querySelector('#shareBadgeTextarea').value =
      '<a class="requirebin-link" target="_blank" href="' + window.location.origin + '/?gist=' + gistID + '">' +
      '<img src="' + window.location.origin + '/badge.png"></a>'
    document.querySelector('#markdownShareBadgeTextarea').value =
      '[![view on requirebin](' + window.location.origin + '/badge.png)](' + window.location.origin + '/?gist=' + gistID + ')'
    $('#share-options input').change(function () {
      self.updateShareIFrameSrc(gistID)
    })
  },

  /**
   * display error/warning messages in the site header
   * cssClass should be a default bootstrap class
   * @param {String} cssClass warning|alert|info|success
   * @param text message content
   */
  tooltipMessage: function (cssClass, text) {
    var message = document.querySelector('.alert')
    if (message) {
      message.classList.remove('hidden')
      message.classList.add('alert-' + cssClass)
      message.innerHTML = text
    } else {
      message = document.createElement('div')
      message.classList.add('alert')
      var close = document.createElement('span')
      close.classList.add('pull-right')
      close.innerHTML = '&times'
      close.addEventListener('click', function () {
        this.parentNode.classList.add('hidden')
      }, false)
      message.classList.add('alert-' + cssClass)
      message.innerHTML = text
      document.querySelector('body').appendChild(message)
      message.appendChild(close)
    }
  },

  showForks: function (forks, parent) {
    var wrap = document.createElement('div')
    var i, header
    function renderRow (data) {
      var row = document.createElement('div')

      // append requirebin link
      var pre = document.createElement('pre')
      pre.appendChild($('<a />', {
        href: data.requireBinLink,
        target: '_blank',
        html: data.requireBinLink
      })[0])
      row.appendChild(pre)

      // append user
      var from = document.createElement('span')
      from.appendChild($('<span />', { html: 'by ' })[0])
      from.appendChild($('<a />', {
        href: data.userOnGithub,
        target: '_blank',
        html: data.user
      })[0])
      row.appendChild(from)
      return row
    }

    if (parent) {
      header = document.createElement('h3')
      header.innerHTML = 'Parent'
      wrap.appendChild(header)
      wrap.appendChild(renderRow(parent))
    }

    if (forks.length) {
      header = document.createElement('h3')
      header.innerHTML = 'Forks'
      wrap.appendChild(header)
      for (i = 0; i < forks.length; i += 1) {
        var row = renderRow(forks[i])
        wrap.appendChild(row)
      }
    }

    this.showPopup(wrap)
  },

  updateShareIFrameSrc: function (gistID) {
    var src = embedURL(gistID)
    var tabs = []
    var formValues = getFormValues(shareForm)

    function getFormValues (form) {
      var values = {}
      for (var i = 0; i < form.elements.length; i += 1) {
        values[form.elements[i].name] = form.elements[i].checked
      }
      return values
    }
    Object.keys(formValues).forEach(function (tab) {
      if (formValues[tab]) {
        tabs.push(tab)
      }
    })
    if (tabs.length) {
      src += '&tabs=' + tabs.join(',')
    }

    document.querySelector('#shareTextarea').value =
      '<iframe width="560" height="315" src="' + src + '" frameborder="0" ' +
      'allowfullscreen></iframe>'
    shareIFrame.src = src
  },

  showEmbed: function (gistID) {
    if (gistID) {
      $('#shareDisabled').hide()
    } else {
      $('#shareInstructions').hide()
    }
    this.updateShareIFrameSrc(gistID)
    this.showPopup('#share')
  },

  showPopup: function (content) {
    $.magnificPopup.open({
      items: {
        type: 'inline',
        src: content
      },
      closeBtnInside: true
    })
  }
}

// changes the active editor
$editorPickerLinks.click(function () {
  var self = $(this)
  var activeEditor
  // there's only one primary button
  var editorName = self.attr('data-editor')
  $editorPickerLinks.removeClass('btn-primary')
  self.addClass('btn-primary')
  // hide all editors and show the active editor
  $editors.addClass('hidden')
  $('#edit-' + editorName).removeClass('hidden')

  // operations done with the codemirror editor
  editors.setActive(editorName)
  activeEditor = editors.getActive()
  activeEditor.emit('afterFocus', activeEditor)
  activeEditor.editor.refresh()
})

module.exports = controls
