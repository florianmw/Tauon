<template>
  <div id="layout">
    <div id="toolbar">
      <div>
        <Button :type="state[1]" @click="listenModal">{{ state[0] }}</Button>
        <Button type="default" @click="clearMsgs">Clear</Button>
      </div>
      <Input v-model="filter" style="width: 420px">
        <Select v-model="filterType" slot="prepend" style="width: 80px">
          <Option value="search" disabled>Search</Option>
          <Option value="filter">Filter</Option>
        </Select>
        <Button slot="append" icon="ios-search"></Button>
      </Input>
    </div>
    <div id="content" v-chat-scroll="{always: false}">
      <pre id="log"></pre>
    </div>
    <Modal v-model="showListen" title="Listen" @on-ok="listen"
      @on-cancel="showListen=false">
      <Form :model="listenForm" :label-width="80">
        <FormItem label="Type">
          <Select v-model="listenForm.type" :rules="{required: true}">
            <Option value="dgram">UDP</Option>
            <Option value="serial" disabled>Serial</Option>
          </Select>
        </FormItem>
        <FormItem label="Port">
            <InputNumber :min="1024" :max="65535" v-model="listenForm.port"
              placeholder="Enter Port" clearable>
            </InputNumber>
        </FormItem>
      </Form>
    </Modal>
    <!--
    <Modal v-model="showMarkup">
    </Modal>
    -->
  </div>
</template>

<script>
  import {ipcRenderer} from 'electron'
  export default {
    name: 'Tauon',
    data () {
      return {
        showListen: false,
        showFilter: false,
        state: ['Listen', 'default'],
        buffer: '',
        patterns: [{pattern: /error/i, bgColor: 'red', color: 'white'}],
        listenForm: {
          port: 21999,
          type: 'dgram'
        },
        filter: '',
        filterType: 'filter'
      }
    },
    mounted () {
      ipcRenderer.on('listening', (evt, addr) => {
        this.state = ['Stop', 'primary']
      })
      ipcRenderer.on('message', (evt, msg, info) => {
        var msgStr = msg.toString()

        // prepend previous received part
        if (this.buffer.length > 0) {
          msgStr = this.buffer + msgStr
          this.buffer = ''
        }

        // messages will be displayed line by line
        var msgs = msgStr.split(/\r?\n/)
        var len = msgs.length - 1

        // detect partly received messages
        if (msgs[len].length > 0) {
          this.buffer = msgs[len]
        }

        for (var i = 0; i < len; i++) {
          var line = msgs[i]
          var style = this.getStyle(line)
          var logContainer = document.getElementById('log')
          var logElement = document.createElement('span')
          var logText = document.createTextNode(line + '\n')

          if (style.length > 0) {
            logElement.setAttribute('style', style)
          }
          logElement.setAttribute('class', 'log')
          logElement.appendChild(logText)
          logContainer.appendChild(logElement)
        }
      })
      ipcRenderer.on('close', (evt) => {
        this.state = ['Listen', 'default']
      })
      ipcRenderer.on('error', (evt, err) => (
        this.$Modal.error({ title: 'Error', content: err })
      ))
    },
    watch: {
      filter (pattern) {
        var logElements = document.getElementById('log').children
        var len = logElements.length

        for (var i = 0; i < len; i++) {
          var elem = logElements[i]
          var show = this.checkDisplay(pattern, elem.innerText)
          var style = this.parseStyle(elem.getAttribute('style'))

          if (show) {
            delete style['display']
          } else if (style['display'] !== 'none') {
            style['display'] = 'none'
          }
          if (Object.keys(style).length > 0) {
            elem.setAttribute('style', this.generateStyle(style))
          } else {
            elem.removeAttribute('style')
          }
        }
      }
    },
    beforeDestroy () {
      ipcRenderer.send('close')
      ipcRenderer.removeAllListeners('listening')
      ipcRenderer.removeAllListeners('message')
      ipcRenderer.removeAllListeners('close')
    },
    methods: {
      listenModal () {
        if (this.state[0] === 'Listen') {
          this.showListen = true
        } else {
          ipcRenderer.send('close')
        }
      },
      listen () {
        ipcRenderer.send('listen', this.listenForm.port)
      },
      clearMsgs () {
        var logContainer = document.getElementById('log')
        var child = logContainer.firstChild

        while (child) {
          logContainer.removeChild(child)
          child = logContainer.firstChild
        }
      },
      getStyle (line) {
        var pLen = this.patterns.length
        var style = []
        for (var j = 0; j < pLen; j++) {
          var pattern = this.patterns[j]
          if (line.search(pattern.pattern) !== -1) {
            if (pattern.color) {
              style['color'] = pattern.color
            }
            if (pattern.bgColor) {
              style['background-color'] = pattern.bgColor
            }
            break
          }
        }

        if (!this.checkDisplay(this.filter, line)) {
          style['display'] = 'none'
        }

        return this.generateStyle(style)
      },
      checkDisplay (filter, line) {
        return !(this.filterType === 'filter' && filter.length > 0 &&
            line.search(filter) === -1)
      },
      parseStyle (style) {
        var obj = []
        if (style) {
          var styles = style.split(';')
          for (var i = 0; i < styles.length; i++) {
            var pair = styles[i].split(':')
            if (pair.length === 2) {
              obj[pair[0]] = pair[1]
            }
          }
        }
        return obj
      },
      generateStyle (obj) {
        var style = ''
        var keys = Object.keys(obj)
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i]
          style += key + ':' + obj[key] + ';'
        }
        return style
      }
    }
  }
</script>

<style>
pre {
  margin: 0px;
}
#content {
  height: calc(100vh - 42px);
  overflow-y: scroll;
}
#toolbar {
  display: flex;
  justify-content: space-between;
  height: 42px;
  padding: 4px;
  background-color: #f7f7f7;
}
#toolbar>* {
  box-sizing: border-box;
}
.log {
  padding: 2px;
  font-family: monospace;
}
</style>
