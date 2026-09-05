/* Gesprächsbäume. Ein Dialog besteht aus Knoten mit Optionen; jede Option kann
   Antworten, Aktionen und einen Folgeknoten haben. */
(function (ATL) {
  const dialogs = {};
  ATL.dialogs = { define: (id, tree) => { dialogs[id] = tree; return tree; }, get: (id) => dialogs[id] };

  ATL.Game.prototype.dialog = async function (id, startNode) {
    const tree = typeof id === 'string' ? dialogs[id] : id;
    if (!tree) throw new Error('Unbekannter Dialog: ' + id);
    const key = typeof id === 'string' ? id : (tree.id || 'anon');
    let node = startNode || tree.start || 'root';
    this.inDialog = true;
    const wasBusy = this.busy;
    this.busy = true;
    if (this.ui) this.ui.showDialogPanel();
    try {
      let guard = 0;
      while (node && guard++ < 200) {
        const nd = tree.nodes[node];
        if (!nd) break;
        if (nd.say) await this.talk(typeof nd.say === 'function' ? nd.say(this) : nd.say);
        if (nd.action) await nd.action(this);
        if (nd.end) break;
        const opts = (nd.options || []).map((o, i) => Object.assign({ _key: 'dlg:' + key + ':' + node + ':' + (o.id || i) }, o))
          .filter((o) => (!o.once || !this.flag(o._key)) && (!o.cond || o.cond(this)));
        if (!opts.length) break;
        let idx;
        if (this.fast) {
          idx = this.testChooser ? this.testChooser(opts, node, key) : 0;
        } else {
          idx = await this.ui.chooseOption(opts.map((o) => (typeof o.text === 'function' ? o.text(this) : o.text)));
        }
        const o = opts[idx];
        if (!o) break;
        if (o.once) this.set(o._key);
        if (o.flag) this.set(o.flag);
        if (!o.silent) await this.say('falk', o.line || (typeof o.text === 'function' ? o.text(this) : o.text));
        if (o.say) await this.talk(typeof o.say === 'function' ? o.say(this) : o.say);
        if (o.action) await o.action(this);
        if (o.end) break;
        node = o.next || node;
      }
    } finally {
      this.inDialog = false;
      this.busy = wasBusy;
      if (this.ui) this.ui.hideDialog();
    }
  };
})(window.ATL);
