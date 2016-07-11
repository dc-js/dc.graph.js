var nepal_queries = [
    {
        name: 'vnf_hosts',
        description: 'hosts on which VNF runs',
        query: `Retrieve P
from PATHS P
where
	P MATCHES VNF(name = "$$1$$")->[Hosted()]{1,5}->Host()
	and length(P) <= 5`,
        select1: {
            name: 'VNF',
            default: 'DNS_VNF',
            init: function(nodes, edges) {
                return nodes.filter(function(n) {
                    return raw_node_type(n) === 'VNF';
                }).map(function(n) {
                    return n.name;
                }).sort();
            }
        }
    },
    {
        name: 'host_vfcs',
        description: 'VFCs running on a given host',
        query: `Retrieve P
from PATHS P
where
	P MATCHES VFC()->[Hosted()]{1,5}->Host(name = "$$1$$")
	and length(P) <= 5`,
        select1: {
            name: 'Host',
            default: 'wt2cwa1esx207',
            init: function(nodes, edges) {
                return nodes.filter(function(n) {
                    return raw_node_type(n) === 'Host';
                }).map(function(n) {
                    return n.name;
                }).sort();
            }
        }
    },
    {
        name: 'windows_vfcs',
        description: 'VFCs running on VMs with Windows Server and hypervisor with 10 NICs',
        query: `Retrieve P
from PATHS P
where
	P MATCHES VFC()->[Hosted()]{1,5}->VM(vm_os="Microsoft Windows Server 2012 (64-bit)")->Host(hw_num_nics=10)
	and length(P) <= 5`
    },
    {
        name: 'vfc_paths',
        description: 'service paths between FNS VFC and DNS VFC',
        query: `Retrieve P
from PATHS P
where
	P MATCHES FNS(name="$$1$$")->[Connects()]{2,4}->DNS()
	and length(P) <= 5`,
        select1: {
            name: 'FNS',
            default: 'FNS01',
            init: function(nodes, edges) {
		return ["FNS01", "FNS02"];
		}
            }
    },
    {
        name: 'virtualization_layer',
        description: 'virtualization-layer service paths between two VMs',
        query: `Retrieve P
from PATHS P
where
	P MATCHES VM(name = "WT2CWA1$$1$$v")->[Connects()]{2,4}->VM(name = "WT2CWA1$$2$$v")`,
        init: function(nodes, edges) {
            if(!qs.showall)
                return ['FNS01', 'IOM01', 'DCM13'];
            return nodes.filter(function(n) {
                return raw_node_type(n) === 'VM' && /WT2CWA1/.test(n.name);
            }).map(function(n) {
                return n.name.replace(/WT2CWA1([A-Z]+[0-9]+)v/, '$1');
            }).sort();
        },
        select1: {
            name: 'Host',
            default: 'FNS01'
        },
        select2: {
            name: 'Host',
            default: 'IOM01'
        }
    },
    {
        name: 'physical_layer',
        description: 'physical-layer service paths between two hosts',
        query: `Retrieve P
from PATHS P
where
	P MATCHES Host(name = "wt2cwa1$$1$$")->[Connects()]{2,4}->Host(name = "wt2cwa1$$2$$")`,
        init: function(nodes, edges) {
            if(!qs.showall)
	        return ['esx507', 'esx201', 'esx402'];
            return nodes.filter(function(n) {
                return raw_node_type(n) === 'Host' && /wt2cwa1/.test(n.name);
            }).map(function(n) {
                return n.name.replace(/WT2CWA1([A-Z]+[0-9]+)v/, '$1');
            }).sort();
	},
        select1: {
            name: 'Host 1',
            default: 'esx507'
        },
        select2: {
            name: 'Host 2',
            default: 'esx201'
        }
    }
];

