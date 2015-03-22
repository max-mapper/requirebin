var $ = window.$

var editors = require('./editors')

var $spinner = $(document.querySelector('.spinner'))
var $runButton = $(document.querySelector('.play-button'))
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

$('.run-btn').click(function (e) {
  e.preventDefault()
  $('a[data-action="play"]').click()
  return false
})

module.exports = controls
