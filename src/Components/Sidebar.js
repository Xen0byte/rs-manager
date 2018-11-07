import React from 'react'
import PropTypes from 'prop-types';
import TreeView from '../lib/deni-react-treeview'
import { createRSSongList } from '../sqliteService';
import { getShowPSStatsConfig } from '../configService';
import '../css/Sidebar.scss'

export default class Sidebar extends React.Component {
  constructor(props) {
    super(props)
    this.activeClass = 'active activeList'
    this.collapseClass = 'collapse list-unstyled'
    this.expandedClass = 'list-unstyled'
    this.state = {
      currentTab: 'tab-dashboard',
      expandedTabs: [],
      currentChildTab: '',
      versionCm: null,
      psusage: null,
      showpsstats: false,
    }
    this.psInterval = null;
    this.treeViewRef = React.createRef();
  }

  componentDidMount = async () => {
    this.toggleActive(this.state.TabsData[0]);
    this.startPSMonitor();
  }

  setChildActive(val, cid) {
    this.setState({ currentTab: val.id, currentChildTab: cid.id })
    this.props.handleChange(val, cid)
  }

  startPSMonitor = async () => {
    if (this.psInterval) clearInterval(this.psInterval);
    const showpsstats = await getShowPSStatsConfig();
    this.setState({ psusage: null, showpsstats })
    if (!showpsstats) {
      return;
    }
    this.psInterval = setInterval(async () => {
      if (!this.state.showpsstats) { return; }
      const rssniffer = await window.findProcess("name", "RockSniffer.exe");
      const rssnniferpid = rssniffer.length > 0 ? parseInt(rssniffer[0].pid, 10) + 1 : -1;
      const rsprocess = await window.findProcess("name", "Rocksmith2014");
      const rsprocesspid = rsprocess.length > 0 ? rsprocess[0].pid : -1;
      const pidstocheck = []
      if (rssnniferpid !== -1) pidstocheck.push(rssnniferpid);
      if (rsprocesspid !== -1) pidstocheck.push(rsprocesspid);
      const psdata = pidstocheck.length > 0 ? await window.pidusage(pidstocheck) : null;
      const rsprocesscpu = rsprocesspid !== -1 ? psdata[rsprocesspid].cpu.toFixed(2) + "%" : "-";
      const rsprocessmemory = rsprocesspid !== -1 ? Math.round(psdata[rsprocesspid].memory / (1024 * 1024)) + "m" : "-";
      const rssniffercpu = rssnniferpid !== -1 ? psdata[rssnniferpid].cpu.toFixed(2) + "%" : "-";
      const rssniffermemory = rssnniferpid !== -1 ? Math.round(psdata[rssnniferpid].memory / (1024 * 1024)) + "m" : "-";

      const ps = (
        <tbody>
          <tr>
            <td style={{ textAlign: 'left' }}>Rocksmith2014</td>
            <td>{rsprocesscpu}</td>
            <td>{rsprocessmemory}</td>
          </tr>
          <tr>
            <td style={{ textAlign: 'left' }}>RockSnifer</td>
            <td>{rssniffercpu}</td>
            <td>{rssniffermemory}</td>
          </tr>
        </tbody>
      );
      if (this.state.showpsstats) this.setState({ psusage: ps })
    }, 2000);
  }

  componentDidMount = () => {
    this.checkForUpdate();
  }

  checkForUpdate = async () => {
    const updateUrl = "https://api.github.com/repos/sandiz/rs-manager/releases/latest";
    const updateData = await window.fetch(updateUrl);
    const json = await updateData.json();
    const currVersion = window.remote.app.getVersion();
    const serverVersion = "tag_name" in json ? json.tag_name : "";
    const downloadUrl = "html_url" in json ? json.html_url : "";

    let updateAvailable = false;
    if (serverVersion !== "") {
      const serverVersionnov = serverVersion.replace("v", ""); //replace v prefix
      if (this.versionCompare(serverVersionnov, currVersion) > 0) {
        updateAvailable = true;
      }
    }
    let cm = null;
    if (updateAvailable) {
      cm = (
        <div>
          <div
            style={{
              width: 100 + '%',
              position: 'absolute',
              bottom: 70 + 'px',
              fontSize: 13 + 'px',
            }}
            className="ta-center"
          >
            New Version Available: {serverVersion}
          </div>
          <div
            style={{
              width: 100 + '%',
              position: 'absolute',
              bottom: 17 + 'px',
              fontSize: 13 + 'px',
            }}
            className="ta-center"
          >
            <a
              onClick={() => window.shell.openExternal(downloadUrl)}
              style={{ width: 50 + '%' }}
              className="extraPadding download">Download</a>
          </div>
        </div>
      )
    }
    else {
      cm = (
        <span
          style={{
            width: 100 + '%',
            position: 'absolute',
            bottom: 17 + 'px',
            fontSize: 13 + 'px',
          }}
          className="ta-center">
          {"v" + currVersion}
        </span>
      );
    }
    this.setState({ versionCm: cm });
  }

  versionCompare = (v1, v2, options) => {
    const lexicographical = options && options.lexicographical
    const zeroExtend = true
    let v1parts = v1.split('.')
    let v2parts = v2.split('.')

    function isValidPart(x) {
      return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
    }

    if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
      return NaN;
    }

    if (zeroExtend) {
      while (v1parts.length < v2parts.length) v1parts.push("0");
      while (v2parts.length < v1parts.length) v2parts.push("0");
    }

    if (!lexicographical) {
      v1parts = v1parts.map(Number);
      v2parts = v2parts.map(Number);
    }

    for (let i = 0; i < v1parts.length; i += 1) {
      if (v2parts.length === i) {
        return 1;
      }

      if (v1parts[i] === v2parts[i]) {
        continue;
      }
      else if (v1parts[i] > v2parts[i]) {
        return 1;
      }
      else {
        return -1;
      }
    }

    if (v1parts.length !== v2parts.length) {
      return -1;
    }

    return 0;
  }

  createNewSetlist = async () => {
    const ts = Math.round((new Date()).getTime() / 1000);
    const tablename = "setlist_custom_" + ts;
    const displayname = "New Setlist #" + ts;
    await createRSSongList(tablename, displayname);
    this.props.RefreshTabs();
    console.log("Created new setlist ", tablename, displayname);
  }

  refresh = () => {
    //this.checkForUpdate();
    this.startPSMonitor();
  }

  onSelectItem = (item) => {
    const api = this.treeViewRef.current.api;
    const parent = api.getParentNode(item);
    if (typeof item.children !== "undefined") {
      if (item.children.length === 0) {
        this.props.handleChange(item, null);
        return;
      } else {
        //TreeViewItemHelper.treeviewItemExpandButtonMouseDown(this.treeViewRef.current, item);
        /*item.expanded = !item.expanded;
        if (item.expanded) {
          api.selectItem(item.children[0]);
          this.props.handleChange(item, item.children[0])
        }*/
        //console.log(item)
        return;
      }
    }
    if (item.id === "add-setlist") {
      this.createNewSetlist();
      return;
    }
    this.props.handleChange(parent, item);
  }

  onAfterLoad = (data, item) => {
    if (data.length > 0) {
      /* ugly hack */
      /* for some reason treeviewRef is null, unless we wait a bit */
      setTimeout(() => {
        const api = this.treeViewRef.current.api;
        api.selectItem(data[0]);
      }, 250);
    }
  }

  onRenderItem = (item, treeview) => {
    let extraChildren = null;
    const isChildAndLeaf = item.isLeaf && treeview.api.getParentNode(item) !== null;
    if (typeof item.children !== "undefined" && item.children.length > 0) {
      extraChildren = (
        <React.Fragment>
          <a className="dropdown-toggle" data-toggle="collapse">
            <span className="actionButton trash" />
          </a>
        </React.Fragment>
      )
    }
    const childclass = isChildAndLeaf ? "treeview-item-custom-text child-and-leaf" : "treeview-item-custom-text parent-only";
    return (
      <div className="treeview-item-custom">
        <span className={childclass}>{item.name}</span>
        {extraChildren}
      </div>
    )
  }

  getSublist = (tab) => {
    return tab.child.map((childtab, index2) => {
      if (childtab.id === "add-setlist") {
        return (
          <li key={`child-key-${childtab.id}`}>
            <a className={this.state.currentTab === tab.id && this.state.currentChildTab === childtab.id ? 'activeChildTab' : 'inactiveChildTab'} onClick={() => this.createNewSetlist()}>{childtab.name}</a><sup>{childtab.tag}</sup>
          </li>
        );
      }
      return (
        <li key={`child-key-${childtab.id}`}>
          <a className={this.state.currentTab === tab.id && this.state.currentChildTab === childtab.id ? 'activeChildTab' : 'inactiveChildTab'} onClick={() => this.setChildActive(tab, childtab)}>{childtab.name}</a><sup>{childtab.tag}</sup>
        </li>
      );
    })
  }

  toggleActive(val) {
    const index = this.state.expandedTabs.indexOf(val.id)
    const tabs = this.state.expandedTabs
    if (index !== -1) {
      tabs.splice(index, 1)
    }
    else {
      tabs.push(val.id)
    }
    this.setState({ currentTab: val.id, expandedTabs: tabs })
    if (val.child.length === 0) {
      this.props.handleChange(val, null)
    }
  }

  render() {
    return (
      <nav id="sidebar" className={this.props.showSidebar ? '' : 'active'}>
        <div className="sidebar-header">
          <h3><a href="#" onClick={this.refresh}>Rocksmith 2014</a></h3>
        </div>

        <ul className="list-unstyled components" style={{ padding: 0 + 'px' }}>
          <div style={{ borderBottom: '1px solid #47748b' }}>
            <p style={{ margin: 0 + 'em' }}>
              Profile: {this.props.currentProfile}<br />
              Steam: {this.props.steamConnected} <br />
              YouTube: {this.props.ytConnected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          <div className="sidebar-custom">
            <TreeView
              //eslint-disable-next-line
              ref={this.treeViewRef}
              className="sidebar-tree"
              showIcon={false}
              items={this.props.TabsV2Data}
              onSelectItem={this.onSelectItem}
              onAfterLoad={this.onAfterLoad}
              onRenderItem={this.onRenderItem}
              selectRow
            />
          </div>
        </ul>
        <div>
          <table className="psTable">
            {this.state.psusage}
          </table>
        </div>
        {this.state.versionCm}
      </nav>
    );
  }
}
Sidebar.propTypes = {
  handleChange: PropTypes.func.isRequired,
  showSidebar: PropTypes.bool.isRequired,
  currentProfile: PropTypes.string,
  steamConnected: PropTypes.string,
  ytConnected: PropTypes.bool,
  TabsV2Data: PropTypes.array,
  //TabsData: PropTypes.array,
  RefreshTabs: PropTypes.func,
}
Sidebar.defaultProps = {
  currentProfile: '',
  steamConnected: false,
  ytConnected: false,
  TabsV2Data: [],
  //TabsData: [],
  RefreshTabs: () => { },
}
