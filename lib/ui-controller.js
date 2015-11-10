var $ = window.$

var editors = require('./editors')

var $spinner = $('.spinner')
var $runButton = $('.play-button')
var $editors = $('.require-bin-editor')
var $editorPickerLinks = $('.editor-picker a')

var controls = {
  $spinner: $spinner,
  $runButton: $runButton,
  enableShare: function (gistID) {
    var textarea = document.querySelector('#shareTextarea')
    var badgeTextarea = document.querySelector('#shareBadgeTextarea')
    var markdownBadgeTextarea = document.querySelector('#markdownShareBadgeTextarea')
    var instructions = document.querySelector('#shareInstructions')
    var disabled = document.querySelector('#shareDisabled')
    $(disabled).addClass('hidden')
    $(instructions).removeClass('hidden')
    textarea.value = '<iframe width="560" height="315" src="' + window.location.origin + '/embed?gist=' + gistID + '" frameborder="0" allowfullscreen></iframe>'
    badgeTextarea.value = '<a class="requirebin-link" target="_blank" href="' + window.location.origin + '/?gist=' + gistID + '"><img src="' + window.location.origin + '/badge.png"></a>'
    markdownBadgeTextarea.value = '[![view on requirebin](' + window.location.origin + '/badge.png)](' + window.location.origin + '/?gist=' + gistID + ')'
  },
  /**
   * return alert element
   */
  getTooltipMessage: function () {
    var message = document.querySelector('.alert')
    if (!message) {
      message = document.createElement('div')
      message.className = 'alert'
      var close = document.createElement('span')
      close.className.add('pull-right')
      close.innerHTML = '&times'
      close.addEventListener('click', function () {
        this.parentNode.classList.add('hidden')
      }, false)
      document.querySelector('body').appendChild(message)
      message.appendChild(close)
    }
    return message
  },
  /**
   * alias for showTooltipMessage
   */
  tooltipMessage: function (cssClass, text) {
      return this.showTooltipMessage(cssClass, text);
  },
  /**
   * display error/warning messages in the site header
   * cssClass should be a default bootstrap class
   * @param {String} cssClass warning|alert|info|success
   * @param text message content
   */
  showTooltipMessage: function (cssClass, text) {
    var message = getTooltipMessage()
    message.innerHTML = text
    message.classList.add('alert-' + cssClass)
    message.classList.remove('hidden')
  },
  /**
   * hide and clean alert element
   */
  hideTooltipMessage: function () {
    var message = getTooltipMessage()
    message.className = 'alert hidden'
    message.innerHTML = ''
  },

  showForks: function (forks, parent) {
    var wrap = document.createElement('div')
    var i, header
    wrap.className = 'white-popup'

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

    $.magnificPopup.open({
      items: {
        type: 'inline',
        src: wrap
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
