var $ = window.$;

var editors = require('./editors')

var $spinner = $(document.querySelector('.spinner'))
var $runButton = $(document.querySelector('.play-button'))
var $editors = $('.require-bin-editor')
var $editorPickerLinks = $('.editor-picker a')
var outputEl = document.querySelector('#play')

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
  }
}

// changes the active editor
$editorPickerLinks.click(function () {
  var self = $(this)
  var editor
  // there's only one primary button
  var editorName = self.attr('data-editor')
  $editorPickerLinks.removeClass('btn-primary')
  self.addClass('btn-primary')
  // hide all editors and show the active editor
  $editors.addClass('hidden')
  $('#edit-' + editorName).removeClass('hidden')

  // operations done with the codemirror editor
  editors.setActive(editorName);
  editor = editors.getActive().editor
  editor.refresh()
})

module.exports = controls