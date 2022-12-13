delete from account;
delete from addressmapping;
delete from commitmenttransaction;
delete from fundingtransaction;
delete from peer;
delete from transaction;
delete from transactionkey;
delete from commitmentrevocation;
delete from htlcontract;
delete from htlcKey;

update account set balance = 1000 where address in ('ab1246ou7902', 'ef1392qw4086');

select * from account;
select * from commitmentrevocation;
select * from addressmapping;
select * from commitmenttransaction;
select * from fundingtransaction;
select * from peer;
select * from transaction;
select * from transactionkey;
select * from htlcontract;
select * from htlcKey;

select * from commitmenttransaction join transactionkey on commitmenttransaction.id = transactionkey.transactionId;

insert into account (address, password, balance) values ('ab01', '01', 2000);
insert into account (address, password, balance) values ('bc02', '02', 3000);
insert into account (address, password, balance) values ('cd03', '03', 4000);
insert into account (address, password, balance) values ('de04', '04', 1500);
insert into account (address, password, balance) values ('ef05', '05', 2600);
insert into account (address, password, balance) values ('fg06', '06', 4900);
insert into account (address, password, balance) values ('gh07', '07', 8100);
insert into account (address, password, balance) values ('hi08', '08', 3480);
insert into account (address, password, balance) values ('ij09', '09', 9860);
insert into account (address, password, balance) values ('jk10', '10', 3290);
insert into account (address, password, balance) values ('kl11', '11', 3700);
insert into account (address, password, balance) values ('lm12', '12', 4500);
insert into account (address, password, balance) values ('mn13', '13', 4000);
insert into account (address, password, balance) values ('no14', '14', 5000);
insert into account (address, password, balance) values ('op15', '15', 6000);
insert into account (address, password, balance) values ('pq16', '16', 7000);
insert into account (address, password, balance) values ('qr17', '17', 6400);
insert into account (address, password, balance) values ('rs18', '18', 8200);
insert into account (address, password, balance) values ('st19', '19', 9300);
insert into account (address, password, balance) values ('tu20', '20', 4600);

insert into Peer (address1, address2) values ('1', '2');
insert into Peer (address1, address2) values ('1', '3');
insert into Peer (address1, address2) values ('1', '4');
insert into Peer (address1, address2) values ('2', '3');
insert into Peer (address1, address2) values ('2', '12');
insert into Peer (address1, address2) values ('3', '6');
insert into Peer (address1, address2) values ('4', '5');
insert into Peer (address1, address2) values ('5', '9');
insert into Peer (address1, address2) values ('6', '8');
insert into Peer (address1, address2) values ('12', '19');
insert into Peer (address1, address2) values ('19', '8');
insert into Peer (address1, address2) values ('9', '11');
insert into Peer (address1, address2) values ('8', '14');
insert into Peer (address1, address2) values ('11', '21');
insert into Peer (address1, address2) values ('21', '14');
insert into Peer (address1, address2) values ('14', '27');
insert into Peer (address1, address2) values ('27', '99');
insert into Peer (address1, address2) values ('27', '98');
insert into Peer (address1, address2) values ('27', '97');
insert into Peer (address1, address2) values ('98', '96');
insert into Peer (address1, address2) values ('98', '95');

