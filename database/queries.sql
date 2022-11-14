delete from addressmapping;
delete from commitmenttransaction;
delete from fundingtransaction;
delete from peer;
delete from transaction;
delete from transactionkey;
delete from commitmentrevocation;

update account set balance = 1000 where address in ('ab1246ou7902', 'ef1392qw4086');

select * from account;
select * from commitmentrevocation;
select * from addressmapping;
select * from commitmenttransaction;
select * from fundingtransaction;
select * from peer;
select * from transaction;
select * from transactionkey;

select * from commitmenttransaction join transactionkey on commitmenttransaction.id = transactionkey.transactionId;

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

