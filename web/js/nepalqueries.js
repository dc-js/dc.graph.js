var nepal_queries = [
    {
        name: 'vnf_hosts',
        description: 'Find all hosts on which VNF runs',
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
                });
            }
        }
    },
    {
        name: 'host_vfcs',
        description: 'Find all VFCs running on a given host',
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
                });
            }
        }
    },
    {
        name: 'windows_vfcs',
        description: 'Find all VFCs running on VMs with Windows Server and hypervisor with 10 NICs',
        query: `Retrieve P
from PATHS P
where
	P MATCHES VFC()->[Hosted()]{1,5}->VM(vm_os="Microsoft Windows Server 2012 (64-bit)")->Host(hw_num_nics=10)
	and length(P) <= 5`
    },
    {
        name: 'vfc_paths',
        description: 'Find all service paths between FNS VFC and DNS VFC',
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
        description: 'Find all virtualization-layer service paths between FNS01 and IOM1',
        query: `Retrieve P
from PATHS P
where
	P MATCHES VM(name = "WT2CWA1FNS01v")->[Connects()]{3, 4}->VM(name = "WT2CWA1IOM02v")`
    },
    {
        name: 'physical_layer',
        description: 'Find all physical-layer service paths between two hosts',
        query: `Retrieve P
from PATHS P
where
	P MATCHES Host(name = "wt2cwa1esx507")->[Connects()]{2,4}->Host(name = "wt2cwa1esx201")`
    }
];

